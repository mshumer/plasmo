import { existsSync } from "fs-extra"
import { readdir } from "fs/promises"
import { resolve } from "path"

import { vLog } from "@plasmo/utils"

import { PlasmoExtensionManifestMV2 } from "~features/manifest-factory/mv2"
import { PlasmoExtensionManifestMV3 } from "~features/manifest-factory/mv3"

import type { CommonPath } from "./common-path"
import type { ProjectPath } from "./project-path"

export async function ensureManifest(
  commonPath: CommonPath,
  {
    popupIndexList,
    optionsIndexList,
    contentIndexList,
    newtabIndexList,

    contentsDirectory,
    backgroundIndexList,
    devtoolsIndexList
  }: ProjectPath,
  { browser = "chrome", manifestVersion = "mv3" }
) {
  vLog("Creating Extension Manifest...")

  const hasPopup = popupIndexList.some(existsSync)
  const hasOptions = optionsIndexList.some(existsSync)
  const hasDevtools = devtoolsIndexList.some(existsSync)
  const hasNewtab = newtabIndexList.some(existsSync)

  const contentIndex = getAnyFile(contentIndexList)
  const backgroundIndex = getAnyFile(backgroundIndexList)

  const hasContentsDirectory = existsSync(contentsDirectory)

  const manifestData =
    manifestVersion === "mv3"
      ? new PlasmoExtensionManifestMV3(commonPath)
      : new PlasmoExtensionManifestMV2(commonPath)

  await manifestData.updateEnv()
  await manifestData.updatePackageData()

  manifestData
    .togglePopup(hasPopup)
    .toggleOptions(hasOptions)
    .toggleDevtools(hasDevtools)
    .toggleNewtab(hasNewtab)

  await Promise.all([
    manifestData.createPopupScaffolds(),
    manifestData.createOptionsScaffolds(),
    manifestData.createDevtoolsScaffolds(),
    manifestData.createNewtabScaffolds(),
    contentIndex.exists &&
      manifestData.toggleContentScript(contentIndex.path, true),
    backgroundIndex.exists &&
      manifestData.toggleBackground(backgroundIndex.path, true),
    hasContentsDirectory &&
      readdir(contentsDirectory, { withFileTypes: true }).then((files) =>
        Promise.all(
          files
            .filter((f) => f.isFile())
            .map((f) => resolve(contentsDirectory, f.name))
            .map((filePath) => manifestData.toggleContentScript(filePath, true))
        )
      )
  ])

  await manifestData.write(true)

  return manifestData
}

function getAnyFile(fileList: string[]) {
  let filePath = ""
  const exists = fileList.some((path) => {
    const fileExists = existsSync(path)
    if (fileExists) {
      filePath = path
    }
    return fileExists
  })
  return {
    path: filePath,
    exists
  }
}
