/// The latest version from Cargo.toml.
pub(crate) const CARGO_PKG_VERSION: &str = env!("CARGO_PKG_VERSION");

/// The 8 character short SHA of the latest commit.
pub(crate) const VERGEN_GIT_SHA: &str = env!("VERGEN_GIT_SHA_SHORT");

/// The build timestamp.
pub(crate) const VERGEN_BUILD_TIMESTAMP: &str = env!("VERGEN_BUILD_TIMESTAMP");

/// The target triple.
pub(crate) const VERGEN_CARGO_TARGET_TRIPLE: &str = env!("VERGEN_CARGO_TARGET_TRIPLE");

/// The build features.
pub(crate) const VERGEN_CARGO_FEATURES: &str = env!("VERGEN_CARGO_FEATURES");

/// The short version information for altindexer-api.
pub(crate) const SHORT_VERSION: &str = env!("ALTITRACE_API_SHORT_VERSION");

/// The long version information for altindexer-api.
pub(crate) const LONG_VERSION: &str = concat!(
    env!("ALTITRACE_API_LONG_VERSION_0"),
    "\n",
    env!("ALTITRACE_API_LONG_VERSION_1"),
    "\n",
    env!("ALTITRACE_API_LONG_VERSION_2"),
    "\n",
    env!("ALTITRACE_API_LONG_VERSION_3"),
    "\n",
    env!("ALTITRACE_API_LONG_VERSION_4")
);

/// The build profile name.
pub(crate) const BUILD_PROFILE_NAME: &str = env!("ALTITRACE_API_BUILD_PROFILE");
