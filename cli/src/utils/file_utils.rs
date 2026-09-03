use std::path::{Path, PathBuf};

use walkdir::WalkDir;

/// Collects every `.rs` file under `path`. If `path` is itself a `.rs`
/// file, returns just that file.
pub fn collect_rust_files(path: &Path) -> Vec<PathBuf> {
    if path.is_file() {
        return vec![path.to_path_buf()];
    }

    WalkDir::new(path)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.into_path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("rs"))
        .collect()
}

/// The nearest `Cargo.toml` for `path` (a file or directory), walking up
/// through ancestors. Scout analyzes a crate, not a bare file, so running
/// it against a `.rs` file with no crate context just produces a
/// confusing error -- callers use this to skip Scout cleanly instead.
pub fn find_cargo_manifest(path: &Path) -> Option<PathBuf> {
    let start = if path.is_dir() {
        path
    } else {
        path.parent().unwrap_or(path)
    };

    start
        .ancestors()
        .map(|dir| dir.join("Cargo.toml"))
        .find(|manifest| manifest.is_file())
}

pub fn is_cargo_project(path: &Path) -> bool {
    find_cargo_manifest(path).is_some()
}
