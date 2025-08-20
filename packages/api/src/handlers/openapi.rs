use actix_web::{web, HttpResponse};
use utoipa::{
    openapi::{
        security::{ApiKey, ApiKeyValue, SecurityScheme},
        ComponentsBuilder,
    },
    OpenApi,
};
use utoipa_swagger_ui::SwaggerUi;

use super::{health::HealthApiDoc, simulation::SimulationApiDoc, trace::TraceApiDoc, Handler};
//use super::trace::TraceApiDoc;
use crate::ApiResult;

#[derive(Default)]
pub struct OpenApiHandler {
    api_key_enabled: bool,
}

impl OpenApiHandler {
    pub const fn new(api_key_enabled: bool) -> Self {
        Self { api_key_enabled }
    }

    pub fn into_app_data(self) -> web::Data<Self> {
        web::Data::new(self)
    }

    pub fn create_merged_openapi(api_key_enabled: bool) -> utoipa::openapi::OpenApi {
        let mut openapi_builder = utoipa::openapi::OpenApiBuilder::new()
            .info(
                utoipa::openapi::InfoBuilder::new()
                    .title("Altitrace API")
                    .description(Some("REST API for the Altitrace API"))
                    .version("1.0.0")
                    .build(),
            )
            .servers(Some(vec![utoipa::openapi::ServerBuilder::new()
                .url("http://localhost:8080/v1")
                .description(Some("API v1"))
                .build()]));

        if api_key_enabled {
            openapi_builder = openapi_builder.components(Some(
                ComponentsBuilder::new()
                    .security_scheme(
                        "ApiKeyAuth",
                        SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::new("Authorization"))),
                    )
                    .build(),
            ));
        }

        let mut openapi = openapi_builder.build();

        openapi.merge(HealthApiDoc::openapi());
        openapi.merge(SimulationApiDoc::openapi());
        openapi.merge(TraceApiDoc::openapi());
        openapi
    }
}

async fn get_openapi_json(handler: web::Data<OpenApiHandler>) -> ApiResult<HttpResponse> {
    let openapi = OpenApiHandler::create_merged_openapi(handler.api_key_enabled);
    Ok(HttpResponse::Ok()
        .content_type("application/json")
        .json(openapi))
}

impl Handler for OpenApiHandler {
    fn configure(cfg: &mut web::ServiceConfig) {
        cfg.service(SwaggerUi::new("/docs/{_:.*}").url(
            "/v1/openapi/swagger.json",
            utoipa::openapi::OpenApi::new(
                utoipa::openapi::Info::new("Altitrace Indexer API", "1.0.0"),
                utoipa::openapi::Paths::new(),
            ),
        ))
        .service(web::scope("").route("/swagger.json", web::get().to(get_openapi_json)));
    }
}
