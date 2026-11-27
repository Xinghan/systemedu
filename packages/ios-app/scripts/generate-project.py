#!/usr/bin/env python3
"""Generate a deterministic Xcode project without a machine-specific dependency."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1]
objects = {}

def identifier(name):
    return hashlib.sha256(name.encode()).hexdigest()[:24].upper()

def add(object_name, isa, **fields):
    key = identifier(object_name)
    objects[key] = {"isa": isa, **fields}
    return key

def encode(value, depth=0):
    if isinstance(value, dict):
        return "{\n" + "\n".join("\t" * (depth + 1) + f"{json.dumps(k)} = {encode(v, depth + 1)};" for k, v in value.items()) + "\n" + "\t" * depth + "}"
    if isinstance(value, list):
        return "(" + ", ".join(encode(v, depth + 1) for v in value) + ("," if value else "") + ")"
    return json.dumps(str(value), ensure_ascii=False)

project_id = identifier("project")
app_id = identifier("SystemEdu-target")
children, products, targets = [], [], []
sdk = add("sqlite", "PBXFileReference", lastKnownFileType="sourcecode.text-based-dylib-definition", path="usr/lib/libsqlite3.tbd", sourceTree="SDKROOT")
children.append(sdk)

common = {"CLANG_ENABLE_MODULES": "YES", "SWIFT_VERSION": "5.0", "IPHONEOS_DEPLOYMENT_TARGET": "17.0", "SDKROOT": "iphoneos", "TARGETED_DEVICE_FAMILY": "1,2", "CODE_SIGN_STYLE": "Automatic", "GENERATE_INFOPLIST_FILE": "YES", "SWIFT_EMIT_LOC_STRINGS": "YES"}

def configs(name, settings):
    values = []
    for mode in ["Debug", "Release"]:
        config = {**common, **settings, "SWIFT_OPTIMIZATION_LEVEL": "-Onone" if mode == "Debug" else "-O", "DEBUG_INFORMATION_FORMAT": "dwarf" if mode == "Debug" else "dwarf-with-dsym"}
        if mode == "Debug": config.update({"SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG", "ENABLE_TESTABILITY": "YES"})
        values.append(add(name + mode, "XCBuildConfiguration", name=mode, buildSettings=config))
    return add(name + "configs", "XCConfigurationList", buildConfigurations=values, defaultConfigurationIsVisible="0", defaultConfigurationName="Release")

for name, directory, product_type in [("SystemEdu", "SystemEdu", "application"), ("SystemEduTests", "Tests", "bundle.unit-test"), ("SystemEduUITests", "UITests", "bundle.ui-testing")]:
    source_builds = []
    for source in sorted((root / directory).rglob("*.swift")):
        relative = source.relative_to(root).as_posix()
        ref = add(relative, "PBXFileReference", lastKnownFileType="sourcecode.swift", path=relative, sourceTree="SOURCE_ROOT")
        children.append(ref)
        source_builds.append(add(relative + "build", "PBXBuildFile", fileRef=ref))
    phases = [add(name + "sources", "PBXSourcesBuildPhase", buildActionMask="2147483647", files=source_builds, runOnlyForDeploymentPostprocessing="0")]
    resources, frameworks, dependencies = [], [], []
    if name == "SystemEdu":
        folder = add("runtime-folder", "PBXFileReference", lastKnownFileType="folder", path="SystemEdu/Resources/WebRuntime", sourceTree="SOURCE_ROOT")
        children.append(folder); resources.append(add("runtime-copy", "PBXBuildFile", fileRef=folder))
        frameworks.append(add("sqlite-link", "PBXBuildFile", fileRef=sdk))
    else:
        proxy = add(name + "proxy", "PBXContainerItemProxy", containerPortal=project_id, proxyType="1", remoteGlobalIDString=app_id, remoteInfo="SystemEdu")
        dependencies.append(add(name + "dependency", "PBXTargetDependency", target=app_id, targetProxy=proxy))
        if name == "SystemEduUITests":
            folder = add("ui-fixtures", "PBXFileReference", lastKnownFileType="folder", path="UITests/Fixtures", sourceTree="SOURCE_ROOT")
            children.append(folder); resources.append(add("ui-fixtures-copy", "PBXBuildFile", fileRef=folder))
    phases.extend([add(name + "frameworks", "PBXFrameworksBuildPhase", buildActionMask="2147483647", files=frameworks, runOnlyForDeploymentPostprocessing="0"), add(name + "resources", "PBXResourcesBuildPhase", buildActionMask="2147483647", files=resources, runOnlyForDeploymentPostprocessing="0")])
    extension = ".app" if name == "SystemEdu" else ".xctest"
    product = add(name + "product", "PBXFileReference", explicitFileType="wrapper.application" if name == "SystemEdu" else "wrapper.cfbundle", path=name + extension, sourceTree="BUILT_PRODUCTS_DIR", includeInIndex="0")
    products.append(product)
    settings = {"PRODUCT_NAME": "$(TARGET_NAME)", "PRODUCT_BUNDLE_IDENTIFIER": "xin.systeme.ios" + ("" if name == "SystemEdu" else "." + name), "CURRENT_PROJECT_VERSION": "1", "MARKETING_VERSION": "0.1.0"}
    if name == "SystemEdu":
        settings.update({"INFOPLIST_KEY_CFBundleDisplayName": "SystemEdu", "INFOPLIST_KEY_NSCameraUsageDescription": "拍摄你的队员照片，预览后可选择生成专属动漫形象。原照片不会保存到相册，也不会自动上传。", "INFOPLIST_KEY_UILaunchScreen_Generation": "YES", "INFOPLIST_KEY_UIApplicationSceneManifest_Generation": "YES", "INFOPLIST_KEY_UISupportedInterfaceOrientations": "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight", "INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad": "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight", "LD_RUNPATH_SEARCH_PATHS": "$(inherited) @executable_path/Frameworks"})
    elif name == "SystemEduTests":
        settings.update({"TEST_HOST": "$(BUILT_PRODUCTS_DIR)/SystemEdu.app/SystemEdu", "BUNDLE_LOADER": "$(TEST_HOST)"})
    else:
        settings.update({"TEST_TARGET_NAME": "SystemEdu"})
    targets.append(add(name + "-target", "PBXNativeTarget", name=name, productName=name, productReference=product, productType="com.apple.product-type." + product_type, buildConfigurationList=configs(name, settings), buildPhases=phases, buildRules=[], dependencies=dependencies))

product_group = add("products", "PBXGroup", name="Products", children=products, sourceTree="<group>")
main_group = add("main", "PBXGroup", children=children + [product_group], sourceTree="<group>")
add("project", "PBXProject", attributes={"LastUpgradeCheck": "1600", "BuildIndependentTargetsInParallel": "YES"}, buildConfigurationList=configs("project", {}), compatibilityVersion="Xcode 14.0", developmentRegion="zh-Hans", hasScannedForEncodings="0", knownRegions=["zh-Hans", "en", "Base"], mainGroup=main_group, productRefGroup=product_group, projectDirPath="", projectRoot="", targets=targets)
project = root / "SystemEdu.xcodeproj"
project.mkdir(exist_ok=True)
(project / "project.pbxproj").write_text("// !$*UTF8*$!\n" + encode({"archiveVersion": 1, "classes": {}, "objectVersion": 56, "objects": objects, "rootObject": project_id}) + "\n")
schemes = project / "xcshareddata/xcschemes"; schemes.mkdir(parents=True, exist_ok=True)

def reference(name):
    extension = ".app" if name == "SystemEdu" else ".xctest"
    return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{identifier(name + "-target")}" BuildableName="{name}{extension}" BlueprintName="{name}" ReferencedContainer="container:SystemEdu.xcodeproj"/>'

(schemes / "SystemEdu.xcscheme").write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{reference("SystemEdu")}</BuildActionEntry></BuildActionEntries></BuildAction>
  <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{reference("SystemEduTests")}</TestableReference><TestableReference skipped="NO">{reference("SystemEduUITests")}</TestableReference></Testables></TestAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference("SystemEdu")}</BuildableProductRunnable></LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference("SystemEdu")}</BuildableProductRunnable></ProfileAction>
  <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''')
print(f"Generated {project}")
