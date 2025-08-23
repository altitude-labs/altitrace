use alloy_consensus::ReceiptEnvelope;
use alloy_primitives::Log;
use alloy_provider::{builder, DynProvider, Provider};
use alloy_rpc_types::{Block, BlockId};
use alloy_rpc_types_eth::BlockNumberOrTag;
use alloy_transport_http::reqwest::Url;
use alloy_transport_ws::WsConnect;

use crate::error::ProviderError;

/// RPC provider connection and request handling.
#[derive(Debug, Clone)]
pub struct RpcProvider {
    pub inner: DynProvider,
}

impl RpcProvider {
    /// Creates a new [`RpcProvider`] instance from a given Url. Can handle websocket and http
    /// connection.
    pub async fn new(url: Url) -> eyre::Result<Self> {
        match url.scheme() {
            "http" | "https" => {
                let http_provider = builder().connect_http(url).erased();
                Ok(Self { inner: http_provider })
            }
            "ws" | "wss" => {
                let ws = WsConnect::new(url);
                let ws_provider = builder().connect_ws(ws).await?.erased();
                Ok(Self { inner: ws_provider.erased() })
            }
            _ => Err(eyre::eyre!("Unsupported protocol: {}", url.scheme())),
        }
    }

    pub async fn get_block_by_number(
        &self,
        number: u64,
        full: bool,
    ) -> Result<Block, ProviderError> {
        let to_fetch = BlockNumberOrTag::Number(number);

        let mut block = self.inner.get_block_by_number(to_fetch);

        if full {
            block = block.full();
        }

        block
            .await
            .map_err(|e| ProviderError::fetch_error(to_fetch, e.to_string()))
            .and_then(|opt| opt.ok_or(ProviderError::BlockNotFound(to_fetch)))
    }

    #[allow(dead_code)]
    async fn get_latest_block(&self, full: bool) -> Result<Block, ProviderError> {
        let to_fetch = BlockNumberOrTag::Latest;

        let mut block = self.inner.get_block_by_number(to_fetch);

        if full {
            block = block.full();
        }

        block
            .await
            .map_err(|_| ProviderError::BlockNotFound(to_fetch))
            .and_then(|opt| opt.ok_or(ProviderError::BlockNotFound(to_fetch)))
    }

    #[allow(dead_code)]
    async fn get_block_receipts(
        &self,
        number: u64,
    ) -> Result<Vec<ReceiptEnvelope<Log>>, ProviderError> {
        let to_fetch = BlockNumberOrTag::Number(number);
        let block_id = BlockId::Number(to_fetch);

        let receipts = self
            .inner
            .get_block_receipts(block_id)
            .await
            .map_err(|e| ProviderError::fetch_error(to_fetch, e.to_string()))?
            .ok_or(ProviderError::BlockNotFound(to_fetch))?;

        Ok(receipts
            .into_iter()
            .map(|r| {
                r.into_inner()
                    .map_logs(alloy_rpc_types_eth::Log::into_inner)
            })
            .collect())
    }
}
