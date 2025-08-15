use crate::{
    define_routes,
    handlers::common::{ApiResponse, Handler},
    services::cache::RedisCache,
    ApiResult, START_TIME,
};
use actix_web::{web, HttpResponse};
use serde::Serialize;
use std::time::Instant;
use utoipa::{OpenApi, ToSchema};
use uuid::Uuid;

#[derive(OpenApi)]
#[openapi(
    paths(
        check_health,
    ),
    components(
        schemas(
            HealthStatus,
            CacheHealth,
            ApiResponse<HealthStatus>,
        ),
    ),
    tags(
        (name = "health", description = "Health endpoints for checking the health of the API")
    )
)]
pub struct HealthApiDoc;

#[derive(Serialize, ToSchema)]
pub struct HealthStatus {
    status: String,
    version: String,
    uptime: u64,
    cache: CacheHealth,
}

#[derive(Serialize, ToSchema)]
struct CacheHealth {
    status: String,
    latency_ms: u64,
}

pub struct HealthHandler {
    redis_cache: web::Data<RedisCache>,
}

impl HealthHandler {
    pub const fn new(redis_cache: web::Data<RedisCache>) -> Self {
        Self { redis_cache }
    }

    pub fn into_app_data(self) -> web::Data<Self> {
        web::Data::new(self)
    }

    async fn check_health(&self) -> ApiResult<HttpResponse> {
        let cache_start = Instant::now();
        let cache_status = match self.redis_cache.check_health().await {
            Ok(_) => "healthy",
            Err(_) => "unhealthy",
        };
        let cache_latency = cache_start.elapsed().as_millis() as u64;

        let health = HealthStatus {
            status: if cache_status == "healthy" { "healthy" } else { "degraded" }.to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            uptime: std::time::SystemTime::now()
                .duration_since(*START_TIME)
                .unwrap()
                .as_secs(),
            cache: CacheHealth { status: cache_status.to_string(), latency_ms: cache_latency },
        };

        Ok(ApiResponse::success(health, Uuid::new_v4()).into())
    }
}

#[utoipa::path(
    get,
    path = "/status/healthcheck",
    tag = "health",
    summary = "Check the health of the API",
    description = "Check the health of the API",
    responses(
        (status = 200, description = "Health check successful", body = ApiResponse<HealthStatus>),
        (status = 500, description = "Health check failed", body = ApiResponse<String>)
    )
)]
async fn check_health(handler: web::Data<HealthHandler>) -> ApiResult<HttpResponse> {
    handler.check_health().await
}

define_routes!(
    HealthHandler,
    "/healthcheck",
    "" => { method: get, handler: check_health }
);
