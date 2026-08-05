#!/usr/bin/env bash
# Run a test suite three times and classify the outcome.
#
#   run-thrice.sh <label> <command...>
#
# Exit status is 1 only when the runs disagree with each other (flaky). A suite that
# fails all three times is an ordinary breakage, not flakiness, so it is reported as a
# warning and does not fail this workflow -- CI is the place that catches those.
set -uo pipefail

label="$1"
shift

runs=3
results=()
logs=()

for i in $(seq 1 "$runs"); do
  log="$(mktemp)"
  logs+=("$log")
  echo "::group::${label} run ${i}/${runs}"
  if "$@" 2>&1 | tee "$log"; then
    results+=("pass")
    echo "${label} run ${i}: PASS"
  else
    results+=("fail")
    echo "${label} run ${i}: FAIL"
  fi
  echo "::endgroup::"
done

passes=0
fails=0
for r in "${results[@]}"; do
  if [ "$r" = "pass" ]; then
    passes=$((passes + 1))
  else
    fails=$((fails + 1))
  fi
done

summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
{
  echo "### ${label}"
  echo
  echo "| Run | Result |"
  echo "| --- | --- |"
  for i in $(seq 1 "$runs"); do
    if [ "${results[$((i - 1))]}" = "pass" ]; then
      echo "| ${i} | pass |"
    else
      echo "| ${i} | **fail** |"
    fi
  done
  echo
} >>"$summary"

status=0
if [ "$passes" -gt 0 ] && [ "$fails" -gt 0 ]; then
  {
    echo "**FLAKY** - ${passes}/${runs} passed, ${fails}/${runs} failed. Results are inconsistent across identical runs."
    echo
    echo "<details><summary>Output of the first failing run</summary>"
    echo
    echo '```'
    for i in $(seq 1 "$runs"); do
      if [ "${results[$((i - 1))]}" = "fail" ]; then
        tail -n 60 "${logs[$((i - 1))]}"
        break
      fi
    done
    echo '```'
    echo
    echo "</details>"
    echo
  } >>"$summary"
  echo "::error title=Flaky suite::${label} passed ${passes}/${runs} and failed ${fails}/${runs} runs"
  status=1
elif [ "$fails" -eq "$runs" ]; then
  {
    echo "**CONSISTENTLY FAILING** - failed all ${runs} runs. This is a real breakage, not flakiness; fix it in CI, not here."
    echo
  } >>"$summary"
  echo "::warning title=Consistently failing suite::${label} failed all ${runs} runs (breakage, not flakiness)"
else
  echo "**STABLE** - passed all ${runs} runs." >>"$summary"
  echo ""  >>"$summary"
fi

exit "$status"
