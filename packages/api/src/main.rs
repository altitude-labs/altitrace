use altitrace_api::run_with_shutdown;
use eyre::Result;
use tokio::signal;
use tracing::{info, warn};

#[actix_rt::main]
async fn main() -> Result<()> {
    if dotenvy::dotenv().is_err() {
        warn!(target:"altitrace::api", "Failed to load .env file, continuing without environment variables");
    }

    let shutdown_signal = async {
        tokio::select! {
            _ = signal::ctrl_c() => {
                info!(target:"altitrace::api", "received SIGINT, initiating graceful shutdown");
            }
            _ = async {
                #[cfg(unix)]
                {
                    signal::unix::signal(signal::unix::SignalKind::terminate())
                        .expect("failed to install SIGTERM handler")
                        .recv()
                        .await
                }
                #[cfg(not(unix))]
                {
                    std::future::pending::<()>().await
                }
            } => {
                info!(target:"altitrace::api", "received SIGTERM, initiating graceful shutdown");
            }
        }
    };

    run_with_shutdown(shutdown_signal).await?;
    info!(target:"altitrace::api", "server exited successfully");
    Ok(())
}
