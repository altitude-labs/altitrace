# Define PHONY targets to avoid conflicts with files of the same name
# and to improve performance
.PHONY: build build-altitrace-api build-telegram fmt fmt-altitrace-api fmt-telegram fmt-prisma test test-altitrace-api test-telegram lint lint-altitrace-api lint-telegram lint-prisma pr pr-altitrace-api pr-telegram pr-all

# Build commands
build-altitrace-api:
	cargo +nightly build

build: build-altitrace-api

# Format commands
fmt-altitrace-api:
	cargo +nightly fmt

fmt: fmt-altitrace-api

# Test commands
test-altitrace-api:
	cargo test --workspace --all-features

test: test-altitrace-api

# Lint commands
lint-altitrace-api:
	cargo +nightly clippy \
	--workspace \
	--lib \
	--examples \
	--tests \
	--all-targets \
	--all-features

lint: lint-altitrace-api

# Fix
clippy-fix:
	cargo +nightly clippy \
	--workspace \
	--lib \
	--examples \
	--tests \
	--benches \
	--all-features \
	--fix \
	--allow-staged \
	--allow-dirty \
	-- -D warnings

fix-lint:
	make clippy-fix && \
	make fmt-altitrace-api

# PR verification commands - run before submitting a PR
pr-altitrace-api: fmt-altitrace-api lint-altitrace-api test-altitrace-api

pr-all: pr-altitrace-api

# Default PR command - runs all checks
pr: pr-all