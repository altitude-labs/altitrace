use std::time::Instant;

use crate::{
    define_routes,
    error::{ApiError, ApiResult},
    handlers::{
        common::{ApiResponse, Handler},
        trace::{dto::*, TracerResponse},
    },
    services::hyperevm::service::HyperEvmService,
    utils::generate_request_id,
};
use actix_web::{web, HttpResponse};
use tracing::debug;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        trace_transaction,
        trace_call,
        trace_call_many,
    ),
    components(
        schemas(
            TraceTransactionRequest,
            TraceCallManyRequest,
            TraceCallRequest,
            TracerResponse,
            ApiResponse<TracerResponse>,
        ApiResponse<Vec<TracerResponse>>,
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
    post,
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
        ?request,
        "Starting transaction trace",
    );

    match handler.service.trace_transaction(&request).await {
        Ok(response) => {
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

            Ok(ApiResponse::success_with_timing(
                tracer_response,
                request_id,
                elapsed.as_millis() as u64,
            )
            .into())
        }
        Err(e) => {
            let elapsed = start_time.elapsed();
            debug!(
                target: "altitrace::trace",
                %request_id,
                ?elapsed,
                error = ?e,
                "Transaction trace failed"
            );

            Err(ApiError::from(e))
        }
    }
}

#[utoipa::path(
    post,
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
        ?request,
        "Starting call trace"
    );

    match handler.service.trace_call(&request).await {
        Ok(response) => {
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

            Ok(ApiResponse::success_with_timing(
                tracer_response,
                request_id,
                elapsed.as_millis() as u64,
            )
            .into())
        }
        Err(e) => {
            let elapsed = start_time.elapsed();
            debug!(
                target: "altitrace::trace",
                %request_id,
                ?elapsed,
                error = ?e,
                "Call trace failed"
            );

            Err(ApiError::from(e))
        }
    }
}

#[utoipa::path(
    post,
    path = "/trace/call-many",
    tag = "trace",
    summary = "Trace multiple calls with state context",
    description = "Execute debug_trace_call_many to trace multiple calls sequentially with cumulative state changes.",
    request_body = TraceCallManyRequest,
    responses(
        (status = 200, description = "Trace completed (success or failure)", body = ApiResponse<Vec<TracerResponse>>),
        (status = 400, description = "Invalid request parameters", body = ApiResponse<String>),
        (status = 500, description = "Internal server error", body = ApiResponse<String>)
    )
)]
async fn trace_call_many(
    handler: web::Data<TraceHandler>,
    request: web::Json<TraceCallManyRequest>,
) -> ApiResult<HttpResponse> {
    let start_time = Instant::now();
    let request_id = generate_request_id();
    let request = request.into_inner();

    debug!(
        target: "altitrace::trace",
        %request_id,
        ?request,
        bundles_count = request.bundles.len(),
        "Starting call many trace"
    );

    match handler.service.trace_call_many(&request).await {
        Ok(responses) => {
            // Convert Vec<TraceResponse> to Vec<TracerResponse>
            let tracer_responses: Vec<TracerResponse> = responses
                .into_iter()
                .map(|response| {
                    let mut tracer_response = TracerResponse::from(response.trace_result);
                    if let Some(receipt) = response.receipt {
                        tracer_response = tracer_response.with_receipt(receipt);
                    }
                    if request.tracer_config.should_clean_struct_logger() {
                        tracer_response.clean_struct_logger();
                    }
                    tracer_response
                })
                .collect();

            let elapsed = start_time.elapsed();

            debug!(
                target: "altitrace::trace",
                %request_id,
                responses_count = tracer_responses.len(),
                ?elapsed,
                "Call many trace completed"
            );

            Ok(ApiResponse::success_with_timing(
                tracer_responses,
                request_id,
                elapsed.as_millis() as u64,
            )
            .into())
        }
        Err(e) => {
            let elapsed = start_time.elapsed();
            debug!(
                target: "altitrace::trace",
                %request_id,
                ?elapsed,
                error = ?e,
                "Call many trace failed"
            );

            Err(ApiError::from(e))
        }
    }
}

define_routes!(
    TraceHandler,
    "/trace",
    "/tx" => {
        method: post,
        handler: trace_transaction,
        params: { request: web::Json<TraceTransactionRequest> }
    },
    "/call" => {
        method: post,
        handler: trace_call,
        params: { request: web::Json<TraceCallRequest> }
    },
    "/call-many" => {
        method: post,
        handler: trace_call_many,
        params: { request: web::Json<TraceCallManyRequest> }
    },
);
