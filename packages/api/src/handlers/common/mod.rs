pub mod response;
use actix_web::web::ServiceConfig;
pub use response::*;

/// Trait for configuring handlers in the Actix web application.
pub trait Handler {
    fn configure(cfg: &mut ServiceConfig);
}
