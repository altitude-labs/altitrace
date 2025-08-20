use std::time::Instant;

use crate::{
    define_routes,
    handlers::{
        common::{ApiResponse, Handler},
        trace::{dto::*, TracerResponse},
    },
    services::hyperevm::service::HyperEvmService,
    utils::generate_request_id,
    ApiResult,
};
use actix_web::{web, HttpResponse};
use tracing::debug;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        trace_transaction,
        trace_call,
    ),
    components(
        schemas(
            TraceTransactionRequest,
            TracerResponse,
            ApiResponse<TracerResponse>,
        ),
    ),
    tags(
        (name = "trace", description = "HyperEVM transaction trace endpoints")
    )
)]
pub struct TraceApiDoc;

pub struct TraceHandler {
    service: web::Data<HyperEvmService>,
}

impl TraceHandler {
    pub const fn new(service: web::Data<HyperEvmService>) -> Self {
        Self { service }
    }

    pub fn into_app_data(self) -> web::Data<Self> {
        web::Data::new(self)
    }
}

impl From<TraceHandler> for web::Data<TraceHandler> {
    fn from(handler: TraceHandler) -> Self {
        handler.into_app_data()
    }
}

#[utoipa::path(
    get,
    path = "/trace/tx",
    tag = "trace",
    summary = "Traces a single transaction execution",
    description = "Traces a single transaction execution.",
    request_body = TraceTransactionRequest,
    responses(
        (status = 200, description = "Trace completed (success or failure)", body = ApiResponse<TracerResponse>),
        (status = 400, description = "Invalid request parameters", body = ApiResponse<String>),
        (status = 500, description = "Internal server error", body = ApiResponse<String>)
    )
)]
async fn trace_transaction(
    handler: web::Data<TraceHandler>,
    request: web::Json<TraceTransactionRequest>,
) -> ApiResult<HttpResponse> {
    let start_time = Instant::now();
    let request_id = generate_request_id();
    let request = request.into_inner();

    debug!(
        target: "altitrace::trace",
        %request_id,
        "Starting transaction trace"
    );

    let response = handler.service.trace_transaction(&request).await.unwrap();
    let mut tracer_response = TracerResponse::from(response.trace_result);

    if let Some(receipt) = response.receipt {
        tracer_response = tracer_response.with_receipt(receipt);
    }

    if request.tracer_config.should_clean_struct_logger() {
        tracer_response.clean_struct_logger();
    }

    let elapsed = start_time.elapsed();

    debug!(
        target: "altitrace::trace",
        %request_id,
        ?elapsed,
        "Transaction trace completed"
    );

    Ok(ApiResponse::success_with_timing(tracer_response, request_id, elapsed.as_millis() as u64)
        .into())
}

#[utoipa::path(
    get,
    path = "/trace/call",
    tag = "trace",
    summary = "Get a transaction trace from a call request",
    description = "Get a transaction trace from a call request.",
    request_body = TraceCallRequest,
    responses(
        (status = 200, description = "Trace completed (success or failure)", body = ApiResponse<TracerResponse>),
        (status = 400, description = "Invalid request parameters", body = ApiResponse<String>),
        (status = 500, description = "Internal server error", body = ApiResponse<String>)
    )
)]
async fn trace_call(
    handler: web::Data<TraceHandler>,
    request: web::Json<TraceCallRequest>,
) -> ApiResult<HttpResponse> {
    let start_time = Instant::now();
    let request_id = generate_request_id();
    let request = request.into_inner();

    debug!(
        target: "altitrace::trace",
        %request_id,
        "Starting call trace"
    );

    let response = handler.service.trace_call(&request).await.unwrap();
    let mut tracer_response = TracerResponse::from(response.trace_result);

    if request.tracer_config.should_clean_struct_logger() {
        tracer_response.clean_struct_logger();
    }

    let elapsed = start_time.elapsed();

    debug!(
        target: "altitrace::trace",
        %request_id,
        ?elapsed,
        "Call trace completed"
    );

    Ok(ApiResponse::success_with_timing(tracer_response, request_id, elapsed.as_millis() as u64)
        .into())
}

define_routes!(
    TraceHandler,
    "/trace",
    "/tx" => {
        method: get,
        handler: trace_transaction,
        params: { request: web::Json<TraceTransactionRequest> }
    },
    "/call" => {
        method: get,
        handler: trace_call,
        params: { request: web::Json<TraceCallRequest> }
    },
);
