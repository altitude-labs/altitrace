use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    error::ErrorUnauthorized,
    http::header::{self, HeaderMap},
    Error,
};
use futures_util::future::{ready, LocalBoxFuture, Ready};
use std::sync::Arc;
use tracing::{trace, warn};

#[derive(Clone)]
pub(crate) struct AuthMiddlewareFactory {
    api_token: Arc<String>,
}

impl AuthMiddlewareFactory {
    pub(crate) fn new(api_token: String) -> Self {
        Self { api_token: Arc::new(api_token) }
    }
}

impl AuthMiddlewareFactory {
    pub(crate) fn is_enabled(&self) -> bool {
        !self.api_token.is_empty()
    }
}

impl<S, B> Transform<S, ServiceRequest> for AuthMiddlewareFactory
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = AuthMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddleware { service, api_token: self.api_token.clone() }))
    }
}

pub(crate) struct AuthMiddleware<S> {
    service: S,
    api_token: Arc<String>,
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let sanitized_headers = sanitize_headers_for_logging(req.headers());
        trace!(target: "altitrace::middlewares::auth", headers=?sanitized_headers, "Authenticating request");

        if self.api_token.as_str().is_empty() {
            return Box::pin(self.service.call(req));
        }

        let auth_header = req.headers().get(header::AUTHORIZATION);
        let (is_valid, token_used) = auth_header
            .and_then(|h| h.to_str().ok())
            .map(|token| {
                if token.starts_with("Bearer ") {
                    let token_used = token.trim_start_matches("Bearer ").trim();
                    (token_used == self.api_token.as_str(), token_used)
                } else {
                    (token == self.api_token.as_str(), token)
                }
            })
            .unwrap_or((false, ""));

        if !is_valid {
            warn!(target: "altitrace::middlewares::auth", token_used, "Unauthorized API request");
            return Box::pin(ready(Err(ErrorUnauthorized("Unauthorized"))));
        }

        Box::pin(self.service.call(req))
    }
}

fn sanitize_headers_for_logging(headers: &HeaderMap) -> std::collections::HashMap<String, String> {
    let mut sanitized = std::collections::HashMap::new();

    for (name, value) in headers {
        let name_str = name.as_str();
        let value_str = if name_str.to_lowercase() == "authorization" {
            "[REDACTED]".to_string()
        } else {
            value.to_str().unwrap_or("[INVALID_UTF8]").to_string()
        };
        sanitized.insert(name_str.to_string(), value_str);
    }

    sanitized
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{
        http::{header, StatusCode},
        test::{self, TestRequest},
        web, App,
    };

    async fn test_handler() -> actix_web::Result<&'static str> {
        Ok("success")
    }

    #[actix_web::test]
    async fn test_auth_middleware() {
        let api_token = "test-token".to_string();
        let auth_middleware = AuthMiddlewareFactory::new(api_token.clone());
        let app = test::init_service(
            App::new()
                .wrap(auth_middleware)
                .route("/test", web::get().to(test_handler)),
        )
        .await;

        // Test 1: Valid token
        let req = TestRequest::get()
            .uri("/test")
            .insert_header((header::AUTHORIZATION, format!("Bearer {}", api_token.clone())))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);

        // Test 2: Invalid token
        let req = TestRequest::get()
            .uri("/test")
            .insert_header((header::AUTHORIZATION, "Bearer wrong-token"))
            .to_request();

        let resp = test::try_call_service(&app, req).await;
        assert!(resp.is_err());

        // Test 3: No token
        let req = TestRequest::get().uri("/test").to_request();

        let resp = test::try_call_service(&app, req).await;
        assert!(resp.is_err());

        // Test 4: Local request (should not bypass auth)
        let req = TestRequest::get()
            .uri("/test")
            .insert_header(("x-forwarded-for", "127.0.0.1"))
            .to_request();

        let resp = test::try_call_service(&app, req).await;
        assert!(resp.is_err());
    }

    #[actix_web::test]
    async fn test_no_auth_config() {
        let auth_middleware = AuthMiddlewareFactory::new(String::new());
        let app = test::init_service(
            App::new()
                .wrap(auth_middleware)
                .route("/test", web::get().to(test_handler)),
        )
        .await;

        // Test: Request without token should pass when auth is not configured
        let req = TestRequest::get().uri("/test").to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
    }
}
