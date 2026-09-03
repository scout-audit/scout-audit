use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;

use anyhow::{bail, Context, Result};
use serde::Deserialize;
use tokio::process::Command;
use tokio::time::timeout;

use crate::config;
use crate::models::Finding;
use crate::utils::file_utils::find_cargo_manifest;

pub struct ScoutRunner;

impl ScoutRunner {
    pub fn new() -> Self {
        Self
    }

    /// Runs Scout (`cargo scout-audit`) against the Cargo project containing
    /// `contract_path`. Scout analyzes -- and actually compiles -- a Cargo
    /// package, so this is a no-op (not an error) when `contract_path` isn't
    /// part of one, e.g. a bare `.rs` file or a compiled `.wasm`.
    pub async fn run(&self, contract_path: &Path) -> Result<Vec<Finding>> {
        let Some(manifest_path) = find_cargo_manifest(contract_path) else {
            eprintln!(
                "  (skipping Scout: {} is not part of a Cargo project)",
                contract_path.display()
            );
            return Ok(Vec::new());
        };

        if !self.is_installed().await {
            bail!("Scout not installed. Install with: cargo install cargo-scout-audit");
        }

        // Scout is a `cargo` subcommand (`cargo scout-audit`), not a
        // standalone `scout` binary, and it takes the manifest path, not a
        // source file or directory.
        let output = timeout(
            Duration::from_secs(config::SCOUT_TIMEOUT_SECS),
            Command::new("cargo")
                .arg("scout-audit")
                .arg("--manifest-path")
                .arg(&manifest_path)
                .arg("--output-format")
                .arg("json")
                .output(),
        )
        .await
        .context("Scout timed out")??;

        if !output.status.success() {
            bail!(String::from_utf8_lossy(&output.stderr).into_owned());
        }

        let json_str = String::from_utf8(output.stdout)?;
        parse_report(&json_str)
    }

    async fn is_installed(&self) -> bool {
        // .output() only tells us the process spawned, not that the
        // subcommand exists -- `cargo` itself will happily spawn and then
        // exit non-zero with "no such command: scout-audit" if it isn't.
        Command::new("cargo")
            .args(["scout-audit", "--version"])
            .output()
            .await
            .is_ok_and(|output| output.status.success())
    }
}

impl Default for ScoutRunner {
    fn default() -> Self {
        Self::new()
    }
}

// Scout's real `--output-format json` output is a single report object, not
// a bare findings array. Each finding only carries a `vulnerability_id`;
// its name and severity live on `categories[].vulnerabilities[]` and have
// to be looked up. See CoinFabrik/scout-audit's
// crates/cargo-scout-audit/src/scout/output/report.rs for the source of
// truth this is modeled on.
#[derive(Deserialize)]
struct ScoutReport {
    categories: Vec<ScoutCategory>,
    findings: Vec<ScoutFinding>,
}

#[derive(Deserialize)]
struct ScoutCategory {
    vulnerabilities: Vec<ScoutVulnerability>,
}

#[derive(Deserialize)]
struct ScoutVulnerability {
    id: String,
    name: String,
    /// "Critical" | "Medium" | "Minor" | "Enhancement"
    severity: String,
}

#[derive(Deserialize)]
struct ScoutFinding {
    vulnerability_id: String,
    error_message: String,
    /// e.g. "lib.rs:12:3 - 12:20"
    span: String,
    file_path: String,
}

fn parse_report(json: &str) -> Result<Vec<Finding>> {
    let report: ScoutReport = serde_json::from_str(json).context("Scout returned unexpected JSON")?;

    let by_id: HashMap<&str, (&str, &str)> = report
        .categories
        .iter()
        .flat_map(|c| &c.vulnerabilities)
        .map(|v| (v.id.as_str(), (v.name.as_str(), v.severity.as_str())))
        .collect();

    Ok(report
        .findings
        .into_iter()
        .map(|f| {
            let (name, severity) = by_id
                .get(f.vulnerability_id.as_str())
                .copied()
                .unwrap_or(("Unknown", "Medium"));

            Finding {
                title: name.to_string(),
                severity: map_severity(severity).to_string(),
                description: f.error_message,
                file: Some(f.file_path),
                line: parse_line_start(&f.span),
                source: "scout".to_string(),
            }
        })
        .collect())
}

// Scout's four severities (Critical/Medium/Minor/Enhancement) don't line up
// 1:1 with our five-level scale (critical/high/medium/low/info) -- this is
// a reasonable mapping, not an exact one. Scout has no "high" tier.
fn map_severity(scout_severity: &str) -> &'static str {
    match scout_severity {
        "Critical" => "critical",
        "Medium" => "medium",
        "Minor" => "low",
        "Enhancement" => "info",
        _ => "medium",
    }
}

fn parse_line_start(span: &str) -> Option<usize> {
    span.split(':').nth(1)?.trim().parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_real_shaped_report() {
        let json = r#"{
            "name": "demo",
            "date": "2026-01-01",
            "summary": { "executed_on": [], "total_vulnerabilities": 1, "by_severity": {}, "table": {} },
            "categories": [{
                "id": "validation",
                "name": "Validation",
                "vulnerabilities": [{
                    "id": "unprotected-update-current-contract-wasm",
                    "name": "Unprotected update current contract wasm",
                    "short_message": "",
                    "long_message": "",
                    "severity": "Critical",
                    "help": ""
                }]
            }],
            "findings": [{
                "id": 0,
                "occurrence_index": 1,
                "category_id": "validation",
                "vulnerability_id": "unprotected-update-current-contract-wasm",
                "error_message": "This update function is missing an auth check",
                "span": "lib.rs:42:5 - 42:30",
                "code_snippet": "",
                "package": "demo",
                "file_path": "lib.rs"
            }]
        }"#;

        let findings = parse_report(json).expect("should parse");
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].title, "Unprotected update current contract wasm");
        assert_eq!(findings[0].severity, "critical");
        assert_eq!(findings[0].line, Some(42));
        assert_eq!(findings[0].file.as_deref(), Some("lib.rs"));
        assert_eq!(findings[0].source, "scout");
    }
}
