.PHONY: dev build test clean install lint check

# Start dev mode (Vite + Tauri window)
dev:
	pnpm tauri dev

# Build production .app
build:
	pnpm tauri build

# Install frontend dependencies
install:
	pnpm install

# Run Rust tests
test:
	cd src-tauri && cargo test

# Type-check frontend (no emit)
check:
	pnpm exec tsc --noEmit

# Lint Rust code
lint:
	cd src-tauri && cargo clippy -- -D warnings

# Clean build artifacts
clean:
	rm -rf dist
	cd src-tauri && cargo clean
