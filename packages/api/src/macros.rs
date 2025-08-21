#[macro_export]
macro_rules! define_routes {
    (
        $handler:ty,
        $scope:expr,
        $(
            $route:expr => {
                method: $method:ident,
                handler: $handler_fn:ident
                $(, params: { $($param:ident: $param_type:ty),* })?
            }
        ),*
        $(,)?
    ) => {
        impl Handler for $handler {
            fn configure(cfg: &mut web::ServiceConfig) {
                cfg.service(
                    web::scope($scope)
                        $(.route(
                            $route,
                            web::$method().to(|
                                handler: web::Data<$handler>,
                                $($(
                                    $param: $param_type,
                                )*)?
                            | async move {
                                use tracing::info;

                                info!(
                                    target: "altitrace::api",
                                    handler = stringify!($handler),
                                    endpoint = concat!($scope, $route),
                                );

                                let start = std::time::Instant::now();

                                let result = $handler_fn(
                                    handler,
                                    $($(
                                        $param,
                                    )*)?
                                ).await;

                                let duration = start.elapsed();

                                info!(
                                    target: "altitrace::api",
                                    handler = stringify!($handler),
                                    endpoint = concat!($scope, $route),
                                    ?duration,
                                    "Query completed"
                                );

                                result
                            })
                        ))*
                );
            }
        }
    };
}
