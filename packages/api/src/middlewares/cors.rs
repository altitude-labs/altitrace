use crate::config::CorsConfig;
use actix_cors::Cors;
use actix_web::http::Method;
use tracing::{info, warn};

/// Factory for creating CORS middleware
pub(crate) struct CorsMiddlewareFactory;

impl CorsMiddlewareFactory {
    /// Create a CORS middleware configured according to the environment and configuration
    pub(crate) fn create_cors_middleware(cors_config: &CorsConfig, environment: &str) -> Cors {
        let mut cors = Cors::default();

        match environment {
            "development" | "dev" | "test" => {
                info!(
                    target: "altitrace::cors",
                    "Configuring CORS for {} environment - allowing all origins",
                    environment
                );

                cors = cors
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header()
                    .supports_credentials();
            }
            "production" | "prod" => {
                info!(
                    target: "altitrace::cors",
                    "Configuring CORS for production environment - restricted origins"
                );

                // In production, use the origins specified in the configuration
                if cors_config.allowed_origins.is_empty() {
                    warn!(
                        target: "altitrace::cors",
                        "No allowed origins configured for production - this is a security risk!"
                    );
                    // Fallback secure: do not allow any origin
                    cors = cors.allowed_origin("https://never-allow-this-origin.invalid");
                } else {
                    for origin in &cors_config.allowed_origins {
                        if Self::is_valid_origin(origin) {
                            info!(
                                target: "altitrace::cors",
                                "Adding allowed origin: {}", origin
                            );
                            cors = cors.allowed_origin(origin);
                        } else {
                            warn!(
                                target: "altitrace::cors",
                                "Invalid origin format ignored: {}", origin
                            );
                        }
                    }
                }

                // Configure allowed methods
                cors = match &cors_config.allowed_methods {
                    Some(methods) => {
                        let mut allowed_methods = Vec::new();
                        for method in methods {
                            match method.to_uppercase().as_str() {
                                "GET" => allowed_methods.push(Method::GET),
                                "POST" => allowed_methods.push(Method::POST),
                                "PUT" => allowed_methods.push(Method::PUT),
                                "DELETE" => allowed_methods.push(Method::DELETE),
                                "PATCH" => allowed_methods.push(Method::PATCH),
                                "OPTIONS" => allowed_methods.push(Method::OPTIONS),
                                "HEAD" => allowed_methods.push(Method::HEAD),
                                _ => {
                                    warn!(
                                        target: "altitrace::cors",
                                        "Unknown HTTP method ignored: {}", method
                                    );
                                }
                            }
                        }
                        cors.allowed_methods(allowed_methods)
                    }
                    None => {
                        // Default secure methods for production
                        cors.allowed_methods(vec![
                            Method::GET,
                            Method::POST,
                            Method::PUT,
                            Method::DELETE,
                            Method::OPTIONS,
                        ])
                    }
                };

                // Configure allowed headers
                cors = match &cors_config.allowed_headers {
                    Some(headers) => {
                        let mut cors_with_headers = cors;
                        for header in headers {
                            cors_with_headers = cors_with_headers.allowed_header(header.as_str());
                        }
                        cors_with_headers
                    }
                    None => {
                        // Default secure headers
                        cors.allowed_headers(vec![
                            "accept",
                            "accept-language",
                            "content-type",
                            "authorization",
                            "x-requested-with",
                        ])
                    }
                };

                // Configure credentials
                if cors_config.allow_credentials.unwrap_or(false) {
                    cors = cors.supports_credentials();
                }
            }
            _ => {
                warn!(
                    target: "altitrace::cors",
                    "Unknown environment '{}' - defaulting to restrictive CORS policy",
                    environment
                );

                // Default restrictive policy for unknown environment
                cors = cors
                    .allowed_origin("https://localhost:3000") // Default local origin
                    .allowed_methods(vec![Method::GET, Method::POST, Method::OPTIONS])
                    .allowed_headers(vec!["content-type", "authorization"]);
            }
        }

        // Configure max-age if specified
        if let Some(max_age) = cors_config.max_age {
            cors = cors.max_age(max_age as usize);
        } else {
            // Default max-age of 1 hour
            cors = cors.max_age(3600);
        }

        cors
    }

    /// Validate the format of an origin
    fn is_valid_origin(origin: &str) -> bool {
        // Basic checks to ensure the origin is valid
        if origin == "*" {
            return false; // Never allow * in production
        }

        // Must start with http:// or https://
        if !origin.starts_with("http://") && !origin.starts_with("https://") {
            return false;
        }

        // Must not contain spaces or dangerous characters
        if origin.contains(' ') || origin.contains('\n') || origin.contains('\r') {
            return false;
        }

        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_origins() {
        assert!(CorsMiddlewareFactory::is_valid_origin("https://example.com"));
        assert!(CorsMiddlewareFactory::is_valid_origin("http://localhost:3000"));
        assert!(CorsMiddlewareFactory::is_valid_origin("https://api.example.com"));
    }

    #[test]
    fn test_invalid_origins() {
        assert!(!CorsMiddlewareFactory::is_valid_origin("*"));
        assert!(!CorsMiddlewareFactory::is_valid_origin("example.com"));
        assert!(!CorsMiddlewareFactory::is_valid_origin("https://example.com with space"));
        assert!(!CorsMiddlewareFactory::is_valid_origin("ftp://example.com"));
    }
}
