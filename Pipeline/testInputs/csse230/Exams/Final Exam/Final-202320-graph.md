# Final Exam (Winter 2023) — Graph section

A **non-solution** reference for the graph programming question that appeared on
the Winter 2023 Final. Use this as a self-study guide and as the conceptual
target for the `findUnknownBalloons` drills in your feedback report. No
implementation is given — the goal is to make the problem behavior concrete
without spoiling the algorithm.

## The problem: `findUnknownBalloons`

A balloon-detection operator is auditing a population of balloons. Some
balloons "network" with others — when balloon X networks with balloon Y, there
is a directed edge `X → Y` in the graph. The operator personally inspects and
**confirms** some subset of the balloons. Any balloon in the same network
component as a confirmed balloon is considered transitively confirmed. The
remaining balloons — those not in the same network as anyone confirmed — are
**unknown**.

The Final asks you to add the following method to `Graph<T>`:

```java
Set<T> findUnknownBalloons(Set<T> confirmedBalloons, Set<T> allBalloons)
```

It returns the set of balloons that are NOT in any "confirmed network."

## What "network component" means

"Same network" here is symmetric: balloon X and balloon Y are in the same
network iff X can reach Y *and* Y can reach X. This is the standard definition
of a strongly connected component. The test cases below pin this down.

### Example 0: four balloons

Vertices `{A, B, C, E}`. Edges:

- `A → B`
- `B → C`
- `B → E`
- `C → B`

| confirmed     | expected `unknown` |
|---------------|---------------------|
| all four      | `{}` |
| none          | `{A, B, C, E}` |
| `{A, E}`      | `{B, C}` |
| `{B, C}`      | `{A, E}` |
| `{B}`         | `{A, E}` |
| `{C}`         | `{A, E}` |

The key observation: `{B}` alone produces the same answer as `{C}` alone,
because B and C form a two-way cycle (B → C → B). Confirming either of them
transitively confirms the network they share. A is solo (nothing reaches A) and
E is solo (E reaches nothing), so neither participates in any network beyond
itself.

### Example 1: nine balloons with three distinct networks

Vertices `{A, B, C, D, E, F, G, H, I}`. Edges:

- `A → B`, `B → C`, `B → E`, `C → B`, `C → D`, `D → A` (forms the {A,B,C,D} ring)
- `E → F`, `F → E` (the {E,F} two-cycle)
- `G → H`, `H → G` (the {G,H} two-cycle)
- `I` has no edges

Networks by mutual reachability:

- `{A, B, C, D}` — cycle through A → B → C → D → A
- `{E, F}` — two-cycle
- `{G, H}` — two-cycle
- `{I}` — solo

| confirmed         | expected `unknown` |
|-------------------|---------------------|
| `{E, F, G, H}`    | `{A, B, C, D, I}` |
| `{A, B, C, D}`    | `{E, F, G, H, I}` |
| `{B, C, D}`       | `{E, F, G, H, I}` (B, C, D all share A's network) |
| `{E}`             | `{A, B, C, D, G, H, I}` |
| `{A}`             | `{E, F, G, H, I}` |
| `{D, F, H}`       | `{I}` |
| `{I}`             | `{A, B, C, D, E, F, G, H}` (I's network is just itself) |

Note that B → E exists, but B and E are NOT in the same network — E cannot
reach B back, so the network relationship is one-way and doesn't qualify.

### Example 2: 200 balloons in one ring

200 balloons numbered 0..199, each `k → k+1`, with `199 → 0` closing the ring.
Everyone is in the same network.

| confirmed   | expected `unknown` |
|-------------|---------------------|
| `{"199"}`   | `{}` (any single balloon transitively confirms the whole ring) |
| `{}`        | all 200 balloons |

The 200-balloon case is a perf check: a correct algorithm finishes near-instantly;
a quadratic-per-vertex algorithm is visibly slow.

## The conceptual link

`findUnknownBalloons` is a thin extension of Milestone 2's
`stronglyConnectedComponent`: take the union of `stronglyConnectedComponent(b)`
across all confirmed balloons `b`, and return everything in `allBalloons` that
isn't in that union. That's the standard Final-Exam pattern — take an M1/M2
method and build a higher-level question on top of it.

If your M2 `stronglyConnectedComponent` is correct, `findUnknownBalloons` is a
few lines of glue. If it's wrong, this question is a faithful reproduction of
that bug at a different level of the call stack.
