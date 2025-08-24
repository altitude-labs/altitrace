use config::{Config, ConfigError, Environment, File};
use serde::Deserialize;
use std::path::PathBuf;

pub(crate) const CONFIG_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/config/");

#[derive(Clone, Debug, Deserialize)]
pub struct RedisConfig {
    pub url: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct ApiConfig {
    pub auth_token: Option<String>,
    pub base_url: Option<String>,
    pub cors: CorsConfig,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct CorsConfig {
    pub allowed_origins: Vec<String>,
    pub allowed_methods: Option<Vec<String>>,
    pub allowed_headers: Option<Vec<String>>,
    pub allow_credentials: Option<bool>,
    pub max_age: Option<u32>,
}

#[allow(unused)]
#[derive(Clone, Debug, Deserialize)]
pub(crate) struct AppConfig {
    pub redis: RedisConfig,
    pub server: ServerConfig,
    pub api: ApiConfig,
    pub environment: String,
}

impl AppConfig {
    pub(crate) fn new() -> Result<Self, ConfigError> {
        let config_file = std::env::var("APP_ENVIRONMENT")
            .map(|env| match env.as_str() {
                "test" => "test.toml",
                "development" => "dev.toml",
                "production" => "prod.toml",
                _ => "default.toml",
            })
            .unwrap_or_else(|_| {
                // Fallback to build mode if env var not set
                if cfg!(debug_assertions) {
                    "dev.toml"
                } else {
                    "prod.toml"
                }
            });

        let s = Config::builder()
            // Start off by merging in the appropriate configuration file
            .add_source(File::with_name(
                PathBuf::from(CONFIG_PATH)
                    .join(config_file)
                    .to_str()
                    .unwrap(),
            ))
            // Add in a local configuration file
            // This file shouldn't be checked in to git
            .add_source(
                File::with_name(
                    PathBuf::from(CONFIG_PATH)
                        .join("local.toml")
                        .to_str()
                        .unwrap(),
                )
                .required(false),
            )
            // Add in settings from the environment (with a prefix of APP)
            // Eg.. `APP_DEBUG=1 ./target/app` would set the `debug` key
            .add_source(Environment::with_prefix("app"))
            .build()?;

        // You can deserialize (and thus freeze) the entire configuration as
        s.try_deserialize()
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self::new().expect("Failed to load configuration")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_config() {
        std::env::set_var("APP_ENVIRONMENT", "test");
        dotenvy::dotenv().ok();
        let _ = AppConfig::default();
    }
}
