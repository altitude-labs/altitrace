pub mod config;
pub mod error;
pub mod routes;
pub mod services;
pub mod types;
pub mod utils;
pub mod validation;
#[allow(dead_code)]
pub mod version;

use alloy_transport_http::reqwest::Url;
use chrono::{DateTime, Utc};
pub use services::{service::HyperEvmService, RedisCache, RpcProvider};
use std::{sync::LazyLock, time::SystemTime};
pub mod handlers;
pub mod macros;
pub use routes::*;

pub use utils::validation::*;

use handlers::{Handler, HealthHandler, OpenApiHandler};
mod middlewares;
mod tracing_log;

use actix_web::{
    web::{self, Data},
    App, HttpServer,
};
pub use config::*;

use ::tracing::info;
use clap::{command, Parser};
use error::{ApiResult, CacheError};
use eyre::eyre;
use futures::Future;
use middlewares::{auth::AuthMiddlewareFactory, cors::CorsMiddlewareFactory};
use tracing_log::{init_tracing, LogFileConfig, LogFormat, LogsArgs};

use crate::version::{LONG_VERSION, SHORT_VERSION};

pub type CacheResult<T> = Result<T, CacheError>;

/// The start time of the application, used for uptime calculations.
/// This is a `LazyLock` to ensure it is initialized only once when first accessed.
pub static START_TIME: LazyLock<SystemTime> = LazyLock::new(SystemTime::now);

#[derive(Parser)]
#[command(author, version = SHORT_VERSION, long_version = LONG_VERSION, about, long_about = None)]
struct Args {
    #[command(flatten)]
    log_args: LogsArgs,
}

pub async fn run() -> eyre::Result<()> {
    run_with_shutdown(std::future::pending()).await
}

pub async fn run_with_shutdown<F>(shutdown_signal: F) -> eyre::Result<()>
where
    F: Future<Output = ()>,
{
    // Number of cpus -> used to start the optimal number of workers
    let num_cpus = num_cpus::get();

    let args = Args::parse();

    let file_config = LogFileConfig::new(
        args.log_args.logs_file_dir.clone(),
        args.log_args.logs_file_name.clone(),
        args.log_args.max_log_size_mb * 1024 * 1024,
        args.log_args.max_log_files,
    );

    let _file_guard = init_tracing(LogFormat::Text, Some((args.log_args.logs_format, file_config)))
        .map_err(|e| eyre!("Failed to initialize tracing: {e}"))?;

    let app_config = AppConfig::default();
    let bind_address = format!("{}:{}", app_config.server.host, app_config.server.port);
    let redis_cache = Data::new(RedisCache::init_cache(&app_config.redis).await?);
    info!(target: "altitrace::api", "Starting server on {bind_address}");
    let start_time = *START_TIME;
    info!(target: "altitrace::api", "Application started at {:?}", DateTime::<Utc>::from(start_time));
    let api_config = Data::new(app_config.clone());

    let rpc_url =
        std::env::var("RPC_URL").map_err(|_| eyre!("RPC_URL environment variable is not set"))?;
    let rpc_provider =
        RpcProvider::new(Url::parse(rpc_url.as_str()).map_err(|_| eyre!("Invalid URL"))?).await?;

    let hyperevm_service = Data::new(HyperEvmService::new(rpc_provider));

    let auth_middleware = api_config
        .api
        .auth_token
        .clone()
        .map(AuthMiddlewareFactory::new);

    let server = HttpServer::new(move || {
        let auth_middleware_clone = auth_middleware.clone();

        // Configure CORS middleware
        let cors_middleware = CorsMiddlewareFactory::create_cors_middleware(
            &api_config.api.cors,
            &api_config.environment,
        );

        App::new()
            .wrap(cors_middleware)
            .app_data(api_config.clone())
            .app_data(redis_cache.clone())
            .service(
                web::scope("/v1")
                    .service(
                        // Health check without middleware
                        web::scope("/status").configure(|cfg| {
                            let health_handler = HealthHandler::new(redis_cache.clone());
                            cfg.app_data(health_handler.into_app_data())
                                .configure(HealthHandler::configure);
                        }),
                    )
                    .service(
                        // OpenAPI with auth middleware
                        web::scope("/openapi")
                            .wrap(
                                auth_middleware_clone
                                    .clone()
                                    .unwrap_or_else(|| AuthMiddlewareFactory::new(String::new())),
                            )
                            .configure(|cfg| {
                                let api_key_enabled = auth_middleware_clone
                                    .as_ref()
                                    .map(|auth| auth.is_enabled())
                                    .unwrap_or(false);
                                let openapi_handler = OpenApiHandler::new(api_key_enabled);
                                cfg.app_data(openapi_handler.into_app_data())
                                    .configure(OpenApiHandler::configure);
                            }),
                    )
                    .service(
                        web::scope("")
                            .wrap(
                                auth_middleware_clone
                                    .unwrap_or_else(|| AuthMiddlewareFactory::new(String::new())),
                            )
                            .configure(|cfg| {
                                init_routes(cfg, redis_cache.clone(), hyperevm_service.clone())
                            }),
                    ),
            )
    })
    .workers(num_cpus)
    .bind(bind_address)
    .map_err(|e| eyre!("Failed to start server: {e}"))?
    .run();

    tokio::select! {
        _ = server => {
            info!(target: "altitrace::api", "Server stopped");
        }
        _ = shutdown_signal => {
            info!(target: "altitrace::api", "Received shutdown signal, stopping server");
        }
    }
    Ok(())
}
