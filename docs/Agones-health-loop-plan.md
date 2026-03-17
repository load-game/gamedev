# Agones Health Loop Plan

## Goal

Capture the follow-up plan for adding Agones health heartbeats after the main Agones integration work is in place.

This plan is intentionally separate from `docs/Agones-integration-plan.md` because health-loop behavior changes pod lifecycle semantics and should be rolled out after `Ready` and player tracking are established.

## Scope

This plan covers:

- periodic Agones health pings
- startup and shutdown wiring
- retry and failure-threshold behavior
- test coverage for the health loop

This plan does not cover:

- `Ready`
- player tracking
- `Allocate`, `Reserve`, or metadata APIs

## Assumptions

This work should happen after all of the following are true:

- hosted-runtime Agones gating already uses `usesHostedRuntimeBootstrap(process.env)`
- the Agones HTTP adapter already exists
- `Ready` is already integrated successfully

## Operational Benefit

- Detects wedged or deadlocked runtimes that still have a live process.
- Gives Agones an application-level liveness signal instead of relying only on process/container health.
- Reduces long-lived bad pods that stop servicing players correctly.

## Implementation

Extend the server-side Agones adapter with health-loop behavior.

Recommended adapter additions:

- `startHealthLoop()`
- `stopHealthLoop()`

Recommended runtime behavior:

- Start the health loop only after `Ready` succeeds.
- Stop the health loop on `SIGINT` and `SIGTERM`.
- Emit concise logs on repeated failures.
- Tolerate a small number of transient failures before taking action.
- If failures continue past a defined threshold, exit non-zero and let Agones/Kubernetes replace the pod.

Recommended code-level defaults:

- heartbeat interval: `5` seconds
- consecutive failure threshold before exit: `3`

These should be implemented as code constants for now, not new env vars.

## Hook Points

Primary runtime hooks:

- startup flow in `src/server/index.js`
- shutdown handlers in `src/server/index.js`

Expected sequence:

1. runtime startup completes
2. Agones `Ready` succeeds
3. health loop starts
4. shutdown signal arrives
5. health loop stops
6. existing graceful shutdown path continues

## Failure Policy

Target behavior:

- a single failed health ping does not terminate the process
- short SDK-sidecar hiccups are retried automatically
- sustained failures past the threshold terminate the runtime with a non-zero exit code

This keeps the runtime resilient to brief transport issues while still allowing bad pods to be recycled.

## Acceptance Criteria

- Health pings start only after the runtime is ready.
- Health pings stop during graceful shutdown.
- Short-lived failures do not kill the pod immediately.
- Sustained health failures eventually terminate the runtime so it can be replaced.
- No health-loop activity runs in local dev or non-hosted/self-hosted environments.

## Tests

- Unit tests for health loop start/stop behavior.
- Unit tests for retry and failure-threshold handling.
- Integration test that startup does not start health before `Ready`.
- Integration test that shutdown handlers stop the health loop.
- Negative-path integration test that sustained health failures cause a non-zero exit path.

## Rollout Notes

Roll this out after the main Agones plan, not alongside it.

Suggested implementation order:

1. extend the Agones adapter with health-loop support
2. wire startup to start the loop only after `Ready`
3. wire shutdown handlers to stop the loop
4. add failure-threshold behavior
5. ship with focused test coverage

## Success Metric

The main outcome of this work is faster replacement of unhealthy runtimes that remain alive at the process level but are no longer functioning correctly.
