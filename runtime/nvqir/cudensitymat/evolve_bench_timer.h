// Optional, env-gated instrumentation for cudaq::evolve benchmark measurement.
//
// Enabled by setting CUDAQ_BENCH_EVOLVE=1 in the environment. When enabled,
// scoped timers accumulate per-thread wall-clock for four evolve phases and
// a final `flush()` call emits one JSON object to
// /tmp/cudaq_evolve_timings.jsonl (override with CUDAQ_BENCH_EVOLVE_FILE).
//
// When CUDAQ_BENCH_EVOLVE is unset, every public entry point compiles to a
// no-op. There is no cost on non-bench paths.

#pragma once

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <string>

namespace cudaq::bench {

struct EvolveTimings {
  double opConstructionS{0.0};
  double evolveS{0.0};
  double expvalCollectS{0.0};
  double cppTotalS{0.0};
  long long stepsAccepted{0};
  long long stepsRejected{0};
  bool active{false};
};

inline bool isEnabled() {
  static const bool enabled = []() {
    const char *env = std::getenv("CUDAQ_BENCH_EVOLVE");
    return env && env[0] != '\0' && env[0] != '0';
  }();
  return enabled;
}

inline EvolveTimings &tls() {
  static thread_local EvolveTimings t;
  return t;
}

class ScopedPhase {
public:
  enum Phase { OpConstruction, Evolve, ExpvalCollect, CppTotal };

  ScopedPhase(Phase phase) : phase_(phase), start_(clockNow()) {
    if (isEnabled())
      running_ = true;
  }
  ~ScopedPhase() {
    if (!running_)
      return;
    const double dt = seconds(clockNow() - start_);
    auto &t = tls();
    switch (phase_) {
    case OpConstruction:
      t.opConstructionS += dt;
      break;
    case Evolve:
      t.evolveS += dt;
      break;
    case ExpvalCollect:
      t.expvalCollectS += dt;
      break;
    case CppTotal:
      t.cppTotalS += dt;
      break;
    }
  }

  ScopedPhase(const ScopedPhase &) = delete;
  ScopedPhase &operator=(const ScopedPhase &) = delete;

private:
  using clock = std::chrono::steady_clock;
  static clock::time_point clockNow() { return clock::now(); }
  static double seconds(clock::duration d) {
    return std::chrono::duration<double>(d).count();
  }

  Phase phase_;
  clock::time_point start_;
  bool running_{false};
};

inline void recordStep(bool accepted) {
  if (!isEnabled())
    return;
  if (accepted)
    ++tls().stepsAccepted;
  else
    ++tls().stepsRejected;
}

inline void reset() {
  if (!isEnabled())
    return;
  tls() = EvolveTimings{};
}

inline void flush() {
  if (!isEnabled())
    return;
  auto &t = tls();
  const char *path = std::getenv("CUDAQ_BENCH_EVOLVE_FILE");
  if (!path || !path[0])
    path = "/tmp/cudaq_evolve_timings.jsonl";
  if (std::FILE *f = std::fopen(path, "a")) {
    std::fprintf(f,
                 "{\"dyn_cpp_total_s\":%.9f,\"dyn_op_construction_s\":%.9f,"
                 "\"dyn_evolve_s\":%.9f,\"dyn_expval_collect_s\":%.9f,"
                 "\"dyn_steps_accepted\":%lld,\"dyn_steps_rejected\":%lld}\n",
                 t.cppTotalS, t.opConstructionS, t.evolveS, t.expvalCollectS,
                 t.stepsAccepted, t.stepsRejected);
    std::fclose(f);
  }
  reset();
}

} // namespace cudaq::bench
