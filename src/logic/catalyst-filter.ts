import { RealmInfo } from '../types'

// Utility function to compare semantic versions
export function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split('.').map(Number)
  const v2Parts = version2.split('.').map(Number)

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0
    const v2Part = v2Parts[i] || 0
    if (v1Part > v2Part) return 1
    if (v1Part < v2Part) return -1
  }
  return 0
}

// Function to filter catalysts by version
export function filterCatalystsByVersion(catalysts: RealmInfo[]): {
  updatedCatalysts: RealmInfo[]
  outdatedCatalysts: RealmInfo[]
} {
  if (catalysts.length === 0) {
    return { updatedCatalysts: [], outdatedCatalysts: [] }
  }

  // Find the highest content and lambdas versions
  let maxContentVersion = '0.0.0'
  let maxLambdasVersion = '0.0.0'

  catalysts.forEach((catalyst) => {
    const contentVersion = catalyst.about?.content?.version || '0.0.0'
    const lambdasVersion = catalyst.about?.lambdas?.version || '0.0.0'

    if (compareVersions(contentVersion, maxContentVersion) > 0) {
      maxContentVersion = contentVersion
    }
    if (compareVersions(lambdasVersion, maxLambdasVersion) > 0) {
      maxLambdasVersion = lambdasVersion
    }
  })

  // Separate catalysts into updated and outdated
  const updatedCatalysts: RealmInfo[] = []
  const outdatedCatalysts: RealmInfo[] = []

  catalysts.forEach((catalyst) => {
    const contentVersion = catalyst.about?.content?.version || '0.0.0'
    const lambdasVersion = catalyst.about?.lambdas?.version || '0.0.0'

    const isContentUpToDate = compareVersions(contentVersion, maxContentVersion) >= 0
    const isLambdasUpToDate = compareVersions(lambdasVersion, maxLambdasVersion) >= 0

    if (isContentUpToDate && isLambdasUpToDate) {
      updatedCatalysts.push(catalyst)
    } else {
      outdatedCatalysts.push(catalyst)
    }
  })

  // If all catalysts are up to date, return all as updated
  if (updatedCatalysts.length === catalysts.length) {
    return { updatedCatalysts: catalysts, outdatedCatalysts: [] }
  }

  return { updatedCatalysts, outdatedCatalysts }
}
