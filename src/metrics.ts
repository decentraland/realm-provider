import { validateMetricsDeclaration } from '@dcl/metrics'
import { getDefaultHttpMetrics } from '@dcl/http-server'
import { metricDeclarations as logsMetricsDeclarations } from '@well-known-components/logger'

export const metricDeclarations = {
  ...getDefaultHttpMetrics(),
  ...logsMetricsDeclarations
}

// type assertions
validateMetricsDeclaration(metricDeclarations)
