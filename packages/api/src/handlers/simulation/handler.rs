use crate::{
    define_routes,
    error::{ApiError, ApiResult},
    handlers::{
        common::{ApiResponse, Handler},
        simulation::{dto::*, response::*},
    },
    services::hyperevm::service::HyperEvmService,
};
use actix_web::{web, HttpResponse};
use std::time::Instant;
use tracing::debug;
use utoipa::OpenApi;
use uuid::Uuid;

#[derive(OpenApi)]
#[openapi(
    paths(
        simulate_transaction,
        simulate_batch_transaction,
        create_access_list
    ),
    components(
        schemas(
            SimulationRequest,
            SimulationResult,
            AccessListRequest,
            ApiResponse<SimulationResult>,
            ApiResponse<Vec<SimulationResult>>,
            AccessListResponse,
            ApiResponse<AccessListResponse>,
        ),
    ),
    tags(
        (name = "simulation", description = "HyperEVM transaction simulation endpoints")
    )
)]
pub struct SimulationApiDoc;

pub struct SimulationHandler {
    service: web::Data<HyperEvmService>,
}

impl SimulationHandler {
    pub const fn new(service: web::Data<HyperEvmService>) -> Self {
        Self { service }
    }

    pub fn into_app_data(self) -> web::Data<Self> {
        web::Data::new(self)
    }
}

impl From<SimulationHandler> for web::Data<SimulationHandler> {
    fn from(handler: SimulationHandler) -> Self {
        handler.into_app_data()
    }
}

#[utoipa::path(
    post,
    path = "/simulate",
    tag = "simulation",
    summary = "Simulate transaction execution",
    description = "Simulate a single transaction with comprehensive analysis",
    request_body = SimulationRequest,
    responses(
        (status = 200, description = "Simulation completed (success or failure)", body = ApiResponse<SimulationResult>),
        (status = 400, description = "Invalid request parameters", body = ApiResponse<String>),
        (status = 500, description = "Internal server error", body = ApiResponse<String>)
    )
)]
async fn simulate_transaction(
    handler: web::Data<SimulationHandler>,
    request: web::Json<SimulationRequest>,
) -> ApiResult<HttpResponse> {
    let start_time = Instant::now();
    let request_id = Uuid::new_v4().to_string();
    let simulation_request = request.into_inner();

    debug!(
        target: "altitrace::api::simulation",
        request_id = %request_id,
        calls_count = simulation_request.call_count(),
        ?simulation_request,
        "Processing simulation request"
    );

    match handler
        .service
        .simulate_transaction(simulation_request)
        .await
    {
        Ok(result) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            debug!(
                target: "altitrace::api::simulation",
                request_id = %request_id,
                simulation_id = %result.simulation_id,
                %execution_time,
                status = ?result.status,
                "Simulation completed successfully"
            );

            Ok(ApiResponse::success_with_timing(result, request_id, execution_time).into())
        }
        Err(e) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            debug!(
                request_id = %request_id,
                execution_time_ms = execution_time,
                error = ?e,
                "Simulation failed"
            );

            Err(ApiError::from(e))
        }
    }
}

#[utoipa::path(
    post,
    path = "/simulate/batch",
    tag = "simulation",
    summary = "Simulate multiple independent transactions",
    description = "Simulate a batch of independent transactions with comprehensive analysis",
    request_body = Vec<SimulationRequest>,
    responses(
        (status = 200, description = "Batch simulation completed (includes individual success/failure)", body = ApiResponse<Vec<SimulationResult>>),
        (status = 400, description = "Invalid request parameters", body = ApiResponse<String>),
        (status = 500, description = "Internal server error", body = ApiResponse<String>)
    )
)]
async fn simulate_batch_transaction(
    handler: web::Data<SimulationHandler>,
    request: web::Json<Vec<SimulationRequest>>,
) -> ApiResult<HttpResponse> {
    let start_time = Instant::now();
    let request_id = Uuid::new_v4().to_string();
    let simulation_request = request.into_inner();

    debug!(
        target: "altitrace::api::simulation",
        request_id = %request_id,
        batch_size = simulation_request.len(),
        ?simulation_request,
        "Processing batch simulation request"
    );

    match handler.service.simulate_batch(simulation_request).await {
        Ok(result) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            debug!(
                target: "altitrace::api::simulation",
                request_id = %request_id,
                %execution_time,
                "Batch simulation completed successfully"
            );

            Ok(ApiResponse::success_with_timing(result, request_id, execution_time).into())
        }
        Err(e) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            debug!(
                target: "altitrace::api::simulation",
                request_id = %request_id,
                execution_time_ms = execution_time,
                error = ?e,
                "Batch simulation failed"
            );

            Err(ApiError::from(e))
        }
    }
}

#[utoipa::path(
    post,
    path = "/simulate/access-list",
    tag = "simulation",
    summary = "Get the access list for a transaction",
    description = "Get the access list for a transaction",
    request_body = AccessListRequest,
    responses(
        (status = 200, description = "Access list request completed successfully", body = ApiResponse<AccessListResponse>),
        (status = 400, description = "Invalid request parameters", body = ApiResponse<String>),
        (status = 500, description = "Internal server error", body = ApiResponse<String>)
    )
)]
async fn create_access_list(
    handler: web::Data<SimulationHandler>,
    request: web::Json<AccessListRequest>,
) -> ApiResult<HttpResponse> {
    let start_time = Instant::now();
    let request_id = Uuid::new_v4().to_string();
    let access_list_request = request.into_inner();

    debug!(
        target: "altitrace::api::simulation",
        request_id = %request_id,
        ?access_list_request,
        "Processing access list request"
    );

    match handler
        .service
        .create_access_list(&access_list_request)
        .await
    {
        Ok(result) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            debug!(
                target: "altitrace::api::simulation",
                request_id = %request_id,
                ?execution_time,
                "Access list request completed successfully"
            );

            Ok(ApiResponse::success_with_timing(result, request_id, execution_time).into())
        }
        Err(e) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            debug!(
                target: "altitrace::api::simulation",
                request_id = %request_id,
                execution_time_ms = execution_time,
                error = ?e,
                "Access list request failed"
            );

            Err(ApiError::from(e))
        }
    }
}

define_routes!(
    SimulationHandler,
    "/simulate",
    "" => {
        method: post,
        handler: simulate_transaction,
        params: { request: web::Json<SimulationRequest> }
    },
    "/batch" => {
        method: post,
        handler: simulate_batch_transaction,
        params: { request: web::Json<Vec<SimulationRequest>> }
    },
    "/access-list" => {
        method: post,
        handler: create_access_list,
        params: { request: web::Json<AccessListRequest> }
    }
);
