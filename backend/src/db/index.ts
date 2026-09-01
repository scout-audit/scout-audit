import { Sequelize } from 'sequelize';
import { config } from '../config';

const dialectOptions = config.db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : undefined;

export const sequelize = config.db.url
  ? new Sequelize(config.db.url, { dialect: 'postgres', logging: false, dialectOptions })
  : new Sequelize(config.db.name, config.db.user, config.db.password, {
      host: config.db.host,
      port: config.db.port,
      dialect: 'postgres',
      logging: false,
      dialectOptions,
    });
