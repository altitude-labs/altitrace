use crate::{config::RedisConfig, error::CacheError, CacheResult};

use redis::{aio::MultiplexedConnection, AsyncCommands, Client, RedisError};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

#[derive(Clone)]
pub struct RedisCache {
    client: Client,
}

impl RedisCache {
    pub async fn init_cache(config: &RedisConfig) -> CacheResult<Self> {
        let url = config.url.clone();
        info!(target: "altitrace::api::cache", "Initializing Redis connection to {}", url);

        let client = match Client::open(url.clone()) {
            Ok(client) => client,
            Err(e) => {
                error!(target: "altitrace::api::cache", "Failed to create Redis client: {:#}", e);
                return Err(CacheError::from(e));
            }
        };

        let cache = Self { client };

        // Verify connection works by performing a health check
        match cache.check_health().await {
            Ok(()) => {
                info!(target: "altitrace::api::cache", "Redis connection successfully established");
                Ok(cache)
            }
            Err(e) => {
                error!(target: "altitrace::api::cache", "Redis health check error: {:#}", e);
                Err(e)
            }
        }
    }

    async fn get_conn(&self) -> Result<MultiplexedConnection, RedisError> {
        // IMPROVE: may want to use the get multiplexed tokio connection with treshold to enhance
        // the control over request flow
        self.client.get_multiplexed_tokio_connection().await
    }

    // add a new key value pair in the cache
    pub async fn push<T: Serialize>(
        &self,
        key: &str,
        value: T,
        dur: Option<i64>,
    ) -> CacheResult<()> {
        let mut conn = self.get_conn().await?;
        let serialized_value = serde_json::to_string(&value)?;
        if let Some(duration) = dur {
            conn.expire::<&str, i64>(key, duration).await?;
        }
        conn.set::<&str, String, ()>(key, serialized_value).await?;
        Ok(())
    }

    // get a value associated to a key
    pub async fn pull<T>(&self, key: &str) -> CacheResult<Option<T>>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        // get handle single or multiples values under the hood by switch with mget //@dev idk if
        // multiple set / get are useful
        let mut conn = self.get_conn().await?; // jsp si il y a besoin de recheck la co a chaque fois
        match conn.get::<&str, Option<String>>(key).await {
            Ok(Some(value)) => {
                // Deserialize the string value into type T
                match serde_json::from_str(&value) {
                    Ok(deserialized) => Ok(Some(deserialized)),
                    Err(e) => {
                        error!(target: "altitrace::api::cache", "Deserialization error for key {}: {}", key, e);
                        Err(CacheError::Deserialization(e.to_string()))
                    }
                }
            }
            Ok(None) => Ok(None),
            Err(e) => {
                error!(target: "altitrace::api::cache", "Error during fetch of: {}", key);
                Err(CacheError::from(e))
            }
        }
    }

    // check if a key is already stored in the cache
    pub async fn exist(&self, key: &str) -> CacheResult<Option<bool>> {
        let mut conn = self.get_conn().await.map_err(CacheError::from)?;
        let result: Option<bool> = conn.exists(key).await.map_err(CacheError::from)?;
        Ok(result)
    }

    // remove a key-value pair from the cache
    pub async fn remove(&self, key: &str) -> CacheResult<Option<bool>> {
        let mut conn = self.get_conn().await.map_err(CacheError::from)?;
        let result: Option<bool> = conn.del(key).await.map_err(CacheError::from)?;
        Ok(result)
    }

    // delete every data from the cache
    pub async fn clear(&self) -> CacheResult<()> {
        // [caraReview] no idea how to implement this (and if this is really usefull )
        todo!()
    }

    // TODO: return the value if it exists, else make the query and store the result (insert if not
    // found typeshi)
    pub async fn cache<T: Serialize + for<'de> Deserialize<'de>>(
        &self,
        _key: &str,
        _query_fn: impl Fn() -> CacheResult<T>,
    ) -> CacheResult<T> {
        todo!()
    }

    pub async fn check_health(&self) -> CacheResult<()> {
        let mut conn = self.get_conn().await.map_err(|e| {
            CacheError::Connection(format!("Health check connection failed: {}", e))
        })?;

        const TEST_KEY: &str = "health_check_key";
        const TEST_VALUE: &str = "health_check_value";

        // Set test value
        conn.set::<&str, &str, ()>(TEST_KEY, TEST_VALUE)
            .await
            .map_err(|e| CacheError::Operation(format!("Health check set failed: {}", e)))?;

        // Get test value
        let value = conn
            .get::<&str, Option<String>>(TEST_KEY)
            .await
            .map_err(|e| CacheError::Operation(format!("Health check get failed: {}", e)))?;

        let value = value.ok_or_else(|| {
            CacheError::Operation("Health check test value not found".to_string())
        })?;

        if value != TEST_VALUE {
            return Err(CacheError::Operation(format!(
                "Health check value mismatch: expected '{}', got '{}'",
                TEST_VALUE, value
            )));
        }

        // Cleanup test key
        conn.del::<&str, ()>(TEST_KEY)
            .await
            .map_err(|e| CacheError::Operation(format!("Health check cleanup failed: {}", e)))?;

        Ok(())
    }
}
