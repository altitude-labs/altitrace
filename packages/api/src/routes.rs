use actix_web::web;

use crate::{
    handlers::{simulation::SimulationHandler, trace::TraceHandler, Handler},
    HyperEvmService, RedisCache,
};

/// Initializes the API routes.
pub fn init_routes(
    cfg: &mut web::ServiceConfig,
    _redis: web::Data<RedisCache>,
    hyperevm_service: web::Data<HyperEvmService>,
) {
    let simulation_handler = SimulationHandler::new(hyperevm_service.clone());
    let trace_handler = TraceHandler::new(hyperevm_service);

    cfg.app_data::<web::Data<SimulationHandler>>(simulation_handler.into())
        .configure(SimulationHandler::configure)
        .app_data::<web::Data<TraceHandler>>(trace_handler.into())
        .configure(TraceHandler::configure);
}
