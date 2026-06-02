#target photoshop
// ExportToPNG ps中起始点在左上角,本插件起始点转换到左下角

app.bringToFront();

var scriptVersion = "ExportToPNG1.1.2";
var originalDoc, settings, progress, cancel, psdName, arraypngs = [];
var cID = charIDToTypeID, sID = stringIDToTypeID;

var defaultSettings = {
	writePngs: true,
	writeTemplate: false,
	writeJson: true,
	ignoreHiddenLayers: true,
	groupsAsSkins: false,
	trimWhitespace: false,
	scale: 1,
	padding: 0,
	saveDir: "C:/Images/"
};

try {
	originalDoc = app.activeDocument;
} catch (ignored) {}

loadSettings();
showDialog();

function run () {
	cancel = false;
	deleteDocumentAncestorsMetadata();
	arraypngs = [];
	saveSettings();

	var saveDir = normalizeSaveDir(settings.saveDir);
	new Folder(saveDir).create();

	activeDocument.duplicate();
	psdName = activeDocument.name;
	var docWidth = activeDocument.width.as("px");
	var docHeight = activeDocument.height.as("px");
	var exportScale = settings.scale;

	if (settings.writeTemplate) {
		if (exportScale != 1) {
			storeHistory();
			scaleImage(exportScale);
		}
		var templateFile = new File(saveDir + "template.png");
		if (templateFile.exists) templateFile.remove();
		savePNG(templateFile);
		if (exportScale != 1) restoreHistory();
	}

	if (!settings.writeJson && !settings.writePngs) {
		activeDocument.close(SaveOptions.DONOTSAVECHANGES);
		return;
	}

	try {
		executeAction(sID("rasterizeAll"), undefined, DialogModes.NO);
	} catch (ignored) {}

	var layers = [];
	collectLayers(activeDocument, layers);
	var layersCount = layers.length;

	var json = '{\n"canvas":{';
	json += '"width":' + Math.round(docWidth * exportScale) + ',"height":' + Math.round(docHeight * exportScale) + "},";
	json += '\n"pngdata":{\n';

	var skins = { "root": [] };
	for (var i = layersCount - 1; i >= 0; i--) {
		var layer = layers[i];
		var skinName = "root";
		if (settings.groupsAsSkins && layer.parent.typename == "LayerSet") {
			var parent = layer.parent;
			var path = [];
			while (parent && parent.typename == "LayerSet" && parent.name != psdName && parent.name != "Adobe Photoshop") {
				path.unshift(trim(parent.name));
				parent = parent.parent;
			}
			if (path.length > 0) skinName = path.join("/");
		}
		var skinLayers = skins[skinName];
		if (!skinLayers) skins[skinName] = skinLayers = [];
		skinLayers[skinLayers.length] = layer;
	}

	var totalExport = 0;
	for (var sn in skins) {
		if (skins.hasOwnProperty(sn)) totalExport += skins[sn].length;
	}
	showProgress("Exporting...", totalExport);

	var skinsCount = countAssocArray(skins);
	var skinIndex = 0;
	for (var skinName in skins) {
		if (!skins.hasOwnProperty(skinName)) continue;
		if (cancel) break;

		var skinLayers = skins[skinName];
		var skinLayersCount = skinLayers.length;
		var skinLayerIndex = 0;

		json += '\t"';
		var skname = "";
		if (skinName != "root") {
			json += "/";
			var group = skinLayers[0].parent;
			if (group != null) {
				while (true) {
					skname += group.name;
					if (group.parent != null) {
						group = group.parent;
						if (group.name == psdName || group.name == "Adobe Photoshop") break;
						else skname += "/";
					} else break;
				}
			}
		} else {
			skname = skinName;
		}
		skname = sortString(skname);
		json += skname + '/":\n\t[\n';

		for (var j = skinLayersCount - 1; j >= 0; j--) {
			if (cancel) break;
			var layer = skinLayers[j];
			incrProgress(layer.name);

			var slotName = layerName(layer);
			var attachmentName;
			if (skinName == "root") {
				attachmentName = slotName;
			} else if (settings.groupsAsSkins) {
				attachmentName = "/" + slotName;
			} else {
				attachmentName = skinName + "/" + slotName;
			}

			// PhotoshopToSpine：每层 storeHistory；1:1 trim；PNG 只 scaleImage 一次；JSON 最后乘 S
			var S = exportScale;

			storeHistory();

			for (var li = 0; li < layersCount; li++) {
				if (layers[li] != layer) layers[li].visible = false;
			}
			layer.visible = true;
			showLayerWithParents(layer);

			var x = docWidth;
			var y = docHeight;

			if (settings.trimWhitespace) {
				if (!layer.isBackgroundLayer) {
					activeDocument.trim(TrimType.TRANSPARENT, false, true, true, false);
				}
				x -= activeDocument.width.as("px");
				y -= activeDocument.height.as("px");
				if (!layer.isBackgroundLayer) {
					activeDocument.trim(TrimType.TRANSPARENT, true, false, false, true);
				}
			}

			var pixelW = activeDocument.width.as("px");
			var pixelH = activeDocument.height.as("px");

			if (settings.writePngs) {
				if (S != 1) scaleImage(S);
				if (settings.padding > 0) {
					activeDocument.resizeCanvas(
						activeDocument.width.as("px") + settings.padding * 2,
						activeDocument.height.as("px") + settings.padding * 2,
						AnchorPosition.MIDDLECENTER
					);
				}
				if (settings.groupsAsSkins && skinName != "root") {
					new Folder(saveDir + skname).create();
					savePNG(new File(saveDir + skname + attachmentName + ".png"));
				} else {
					savePNG(new File(saveDir + attachmentName + ".png"));
				}
			}

			restoreHistory();
			layer.visible = false;

			x += Math.round(pixelW) / 2;
			y += Math.round(pixelH) / 2;
			if (S != 1) {
				x = Math.round(x * S);
				y = Math.round(y * S);
			}
			var width = Math.round(pixelW * S);
			var height = Math.round(pixelH * S);

			var index = -1;
			for (var b = 0; b <= layersCount; b++) {
				if (layer == layers[b]) {
					index = b;
					index = (layersCount - 1) - index;
					break;
				}
			}

			json += '\t\t{"pngname":"' + slotName + '","id":' + layer.id + ',"index":' + index
				+ ',"x":' + x + ',"y":' + y + ',"width":' + Math.round(width) + ',"height":' + Math.round(height) + '}';

			skinLayerIndex++;
			json += skinLayerIndex < skinLayersCount ? ",\n" : "\n";
		}
		json += "\t\]";
		skinIndex++;
		json += skinIndex < skinsCount ? ",\n" : "\n";
	}
	json += '}\n}';

	activeDocument.close(SaveOptions.DONOTSAVECHANGES);

	if (settings.writeJson && !cancel) {
		var name = decodeURI(originalDoc.name);
		name = name.substring(0, name.indexOf("."));
		var file = new File(saveDir + name + ".ps.data");
		if (file.exists) file.remove();
		file.open("w", "TEXT");
		file.lineFeed = "\n";
		file.encoding = "UTF-8";
		file.write(json);
		file.close();
	}

	if (cancel) alert("Export cancelled.");
	else showSuccessDialog(saveDir);
}

function showSuccessDialog (folderPath) {
	var dialog = new Window("dialog", "Export  Success !!!");
	dialog.alignChildren = "fill";
	dialog.orientation = "column";
	dialog.add("statictext", undefined, "Open the folder: " + folderPath, {multiline: true});

	var buttonGroup = dialog.add("group");
	buttonGroup.alignment = "center";
	var openButton = buttonGroup.add("button", undefined, "Open");
	var closeButton = buttonGroup.add("button", undefined, "Cancel");

	openButton.onClick = function () {
		var folder = new Folder(folderPath);
		if (folder.exists) folder.execute();
		else alert("Folder not found:\n" + folderPath);
		dialog.close();
	};
	closeButton.onClick = function () {
		dialog.close();
	};

	dialog.center();
	dialog.show();
}

// --- Settings dialog ---

function showDialog () {
	if (!originalDoc) {
		alert("请先打开并保存 PSD 文档后再运行 ExportToPNG。(请先保存psd,在使用)");
		return;
	}
	if (!hasFilePath()) {
		alert("请先保存 PSD 文件后再运行脚本。");
		return;
	}

	var dialog = new Window("dialog",scriptVersion);
	dialog.alignChildren = "fill";

	var settingsGroup = dialog.add("panel", undefined, "Settings");
	settingsGroup.margins = [10, 15, 10, 10];
	settingsGroup.alignChildren = "fill";

	var checkboxGroup = settingsGroup.add("group");
	checkboxGroup.alignChildren = ["left", ""];
	checkboxGroup.orientation = "row";

	var group = checkboxGroup.add("group");
	group.orientation = "column";
	group.alignChildren = ["left", ""];
	var writePngsCheckbox = group.add("checkbox", undefined, " Write Layer PNGs");
	writePngsCheckbox.value = settings.writePngs;

	
	var writeTemplateCheckbox = group.add("checkbox", undefined, " Write a template PNG");
	writeTemplateCheckbox.value = settings.writeTemplate;
	writeTemplateCheckbox.helpTip="是否保存一张模板";

	var writeJsonCheckbox = group.add("checkbox", undefined, " Write  JsonData");
	writeJsonCheckbox.value = settings.writeJson;
	writeJsonCheckbox.helpTip="是否写入json数据";

	group = checkboxGroup.add("group");
	group.orientation = "column";
	group.alignChildren = ["left", ""];
	var ignoreHiddenLayersCheckbox = group.add("checkbox", undefined, " Ignore hidden layers");
	ignoreHiddenLayersCheckbox.value = settings.ignoreHiddenLayers;
	ignoreHiddenLayersCheckbox.helpTip="是否忽略隐藏图层";

	var groupsAsSkinsCheckbox = group.add("checkbox", undefined, " Use groups");
	groupsAsSkinsCheckbox.value = settings.groupsAsSkins;
	groupsAsSkinsCheckbox.helpTip="是否使用组";

	var trimWhitespaceCheckbox = group.add("checkbox", undefined, " Trim whitespace");
	trimWhitespaceCheckbox.value = settings.trimWhitespace;
	trimWhitespaceCheckbox.helpTip = "是否去除透明区域";

	var slidersGroup = settingsGroup.add("group");
	group = slidersGroup.add("group");
	group.orientation = "column";
	group.alignChildren = ["right", ""];
	group.add("statictext", undefined, "Scale:");
	group.add("statictext", undefined, "Padding:");
	group = slidersGroup.add("group");
	group.orientation = "column";
	var scaleText = group.add("edittext", undefined, settings.scale * 100);
	scaleText.characters = 4;
	var paddingText = group.add("edittext", undefined, settings.padding);
	paddingText.characters = 4;
	group = slidersGroup.add("group");
	group.orientation = "column";
	group.add("statictext", undefined, "%");
	group.add("statictext", undefined, "px");
	group = slidersGroup.add("group");
	group.orientation = "column";
	group.alignChildren = ["fill", ""];
	var scaleSlider = group.add("slider", undefined, settings.scale * 100, 1, 400);
	var paddingSlider = group.add("slider", undefined, settings.padding, 0, 4);

	scaleSlider.helpTip = "Scales the PNG files. Useful when using higher resolution art in Photoshop than in Spine.";
	scaleText.onChanging = function () { scaleSlider.value = scaleText.text; };
	scaleSlider.onChanging = function () { scaleText.text = Math.round(scaleSlider.value); };
	paddingText.onChanging = function () { paddingSlider.value = paddingText.text; };
	paddingSlider.onChanging = function () { paddingText.text = Math.round(paddingSlider.value); };

	var outputPathGroup = dialog.add("panel", undefined, "Output Paths");
	outputPathGroup.alignChildren = "fill";
	outputPathGroup.margins = [10, 15, 10, 10];
	outputPathGroup.add("statictext", undefined, "绝对路径，例如 C:/output/").alignment = "center";

	var textGroup = outputPathGroup.add("group");
	group = textGroup.add("group");
	group.orientation = "column";
	group.alignChildren = "right";
	group.add("statictext", undefined, "Save Path:");
	group = textGroup.add("group");
	group.orientation = "column";
	group.alignChildren = "fill";
	var saveDirText = group.add("edittext", undefined, settings.saveDir);
	saveDirText.preferredSize = [220, 20];
	var btnBrowse = textGroup.add("button", undefined, "Browse");
	btnBrowse.preferredSize = [50, 20];
	btnBrowse.onClick = function () {
		var outputFolder = Folder.selectDialog("Select output folder");
		if (outputFolder != null) saveDirText.text = forwardSlashes(outputFolder.fsName) + "/";
	};

	var buttonGroup = dialog.add("group");
	buttonGroup.alignment = "center";
	var runButton = buttonGroup.add("button", undefined, "OK");
	var cancelButton = buttonGroup.add("button", undefined, "Cancel");
	cancelButton.onClick = function () { dialog.close(0); };

	function updateSettings () {
		settings.writePngs = writePngsCheckbox.value;
		settings.writeTemplate = writeTemplateCheckbox.value;
		settings.writeJson = writeJsonCheckbox.value;
		settings.ignoreHiddenLayers = ignoreHiddenLayersCheckbox.value;
		settings.groupsAsSkins = groupsAsSkinsCheckbox.value;
		settings.trimWhitespace = trimWhitespaceCheckbox.value;
		var scaleValue = parseFloat(scaleText.text);
		if (scaleValue > 0 && scaleValue <= 400) settings.scale = scaleValue / 100;
		var paddingValue = parseInt(paddingText.text, 10);
		if (paddingValue >= 0) settings.padding = paddingValue;
		settings.saveDir = saveDirText.text;
	}

	dialog.onClose = function () {
		updateSettings();
		saveSettings();
	};

	runButton.onClick = function () {
		if (scaleText.text <= 0 || scaleText.text > 400) {
			alert("Scale must be between > 0 and <= 400.");
			return;
		}
		if (paddingText.text < 0) {
			alert("Padding must be >= 0.");
			return;
		}
		updateSettings();
		saveSettings();
		dialog.close(0);

		var rulerUnits = app.preferences.rulerUnits;
		app.preferences.rulerUnits = Units.PIXELS;
		try {
			run();
		} catch (e) {
			alert("导出出错:\n[line: " + e.line + "] " + e.message);
		} finally {
			if (activeDocument != originalDoc) {
				try { activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (ignored) {}
			}
			app.preferences.rulerUnits = rulerUnits;
			if (progress && progress.dialog) progress.dialog.close();
		}
	};

	dialog.center();
	dialog.show();
}

function loadSettings () {
	var options;
	try {
		options = app.getCustomOptions("ExportToPNG");
	} catch (ignored) {}
	settings = {};
	var hasSaved = false;
	for (var key in defaultSettings) {
		if (!defaultSettings.hasOwnProperty(key)) continue;
		var typeID = sID(key);
		if (options && options.hasKey(typeID)) {
			settings[key] = options["get" + getOptionType(defaultSettings[key])](typeID);
			hasSaved = true;
		} else
			settings[key] = defaultSettings[key];
	}
	if (!hasSaved) hasSaved = migratePsExporterSettings();
	if (!hasSaved) migrateExportToPngSettings();
}

function migratePsExporterSettings () {
	var found = false;
	try {
		var old = app.getCustomOptions("PsExporter");
		if (!old) return false;
		for (var key in defaultSettings) {
			if (!defaultSettings.hasOwnProperty(key)) continue;
			var typeID = sID(key);
			if (old.hasKey(typeID)) {
				settings[key] = old["get" + getOptionType(defaultSettings[key])](typeID);
				found = true;
			}
		}
	} catch (ignored) {}
	return found;
}

function migrateExportToPngSettings () {
	try {
		var old = app.getCustomOptions(sID("settings"));
		if (!old) return;
		if (old.hasKey(sID("writePngs"))) settings.writePngs = old.getBoolean(sID("writePngs"));
		if (old.hasKey(sID("writeTemplate"))) settings.writeTemplate = old.getBoolean(sID("writeTemplate"));
		if (old.hasKey(sID("writeJson"))) settings.writeJson = old.getBoolean(sID("writeJson"));
		if (old.hasKey(sID("ignoreHiddenLayers"))) settings.ignoreHiddenLayers = old.getBoolean(sID("ignoreHiddenLayers"));
		if (old.hasKey(sID("groupsAsSkins"))) settings.groupsAsSkins = old.getBoolean(sID("groupsAsSkins"));
		if (old.hasKey(sID("trimWhitespace"))) settings.trimWhitespace = old.getBoolean(sID("trimWhitespace"));
		if (old.hasKey(sID("pngScale"))) settings.scale = old.getDouble(sID("pngScale"));
		if (old.hasKey(sID("saveDir"))) settings.saveDir = old.getString(sID("saveDir"));
	} catch (ignored) {}
}

function saveSettings () {
	var desc = new ActionDescriptor();
	for (var key in defaultSettings) {
		if (!defaultSettings.hasOwnProperty(key)) continue;
		desc["put" + getOptionType(defaultSettings[key])](sID(key), settings[key]);
	}
	app.putCustomOptions("ExportToPNG", desc, true);
}

function getOptionType (value) {
	switch (typeof (value)) {
	case "boolean": return "Boolean";
	case "string": return "String";
	case "number": return "Double";
	}
	throw new Error("Invalid default setting: " + value);
}

// --- Progress ---

function showProgress (title, total) {
	if (!progress) {
		var dialog = new Window("palette", "ExportToPNG - " + title);
		dialog.alignChildren = "fill";
		dialog.orientation = "column";
		var message = dialog.add("statictext", undefined, "Exporting...");
		var group = dialog.add("group");
		var bar = group.add("progressbar");
		bar.preferredSize = [300, 16];
		bar.maxvalue = total || 1;
		bar.value = 1;
		var cancelButton = group.add("button", undefined, "Cancel");
		cancelButton.onClick = function () {
			cancel = true;
			cancelButton.enabled = false;
		};
		dialog.center();
		dialog.show();
		progress = { dialog: dialog, bar: bar, message: message };
	} else {
		progress.dialog.text = "ExportToPNG - " + title;
		progress.bar.maxvalue = total || 1;
	}
	progress.count = 0;
	progress.total = total || 1;
	progress.updateTime = 0;
	$.hiresTimer;
}

function incrProgress (text) {
	if (!progress) return;
	progress.count++;
	if (progress.count != 1 && progress.count < progress.total) {
		progress.updateTime += $.hiresTimer;
		if (progress.updateTime < 500000) return;
		progress.updateTime = 0;
	}
	progress.bar.value = progress.count;
	progress.message.text = progress.count + " / " + progress.total + ": " + trim(text);
	if (!progress.dialog.active) progress.dialog.active = true;
}

// --- Photoshop helpers ---

function getLayerBoundsPx (layer) {
	var b = layer.bounds;
	var left = b[0].as("px");
	var top = b[1].as("px");
	var right = b[2].as("px");
	var bottom = b[3].as("px");
	return {
		left: left, top: top, right: right, bottom: bottom,
		width: right - left, height: bottom - top
	};
}

function showLayerWithParents (layer) {
	var p = layer.parent;
	while (p && p.typename == "LayerSet" && p.name != psdName && p.name != "Adobe Photoshop") {
		p.visible = true;
		p = p.parent;
	}
}

// 与 PhotoshopToSpine 相同
function scaleImage (scale) {
	if (scale == 1) return;
	var imageSize = activeDocument.width.as("px") * scale;
	activeDocument.resizeImage(UnitValue(imageSize, "px"), null, null, ResampleMethod.BICUBICAUTOMATIC);
}

var history;
function storeHistory () {
	history = activeDocument.activeHistoryState;
}
function restoreHistory () {
	activeDocument.activeHistoryState = history;
}

function collectLayers (layer, collect) {
	for (var i = 0, n = layer.layers.length; i < n; i++) {
		var child = layer.layers[i];
		if (settings.ignoreHiddenLayers && !child.visible) continue;
		if (!layerHasContent(child)) continue;
		if (child.layers && child.layers.length > 0) {
			collectLayers(child, collect);
		} else if (child.kind == LayerKind.NORMAL) {
			collect.push(child);
			child.visible = false;
		}
	}
}

function layerHasContent (layer) {
	var b = getLayerBoundsPx(layer);
	return b.width > 0 && b.height > 0;
}

function hasFilePath () {
	var ref = new ActionReference();
	ref.putEnumerated(cID("Dcmn"), cID("Ordn"), cID("Trgt"));
	return executeActionGet(ref).hasKey(sID("fileReference"));
}

function normalizeSaveDir (path) {
	path = forwardSlashes(trim(path));
	if (!endsWith(path, "/")) path += "/";
	return path;
}

function savePNG (file) {
	if (indexOf(arraypngs, file.fullName) == -1) {
		arraypngs.push(file.fullName);
		var options = new PNGSaveOptions();
		options.compression = 6;
		activeDocument.saveAs(file, options, true, Extension.LOWERCASE);
	} else {
		alert("exist same layer name :" + decodeURI(file.name) + "\n(同组下存在相同图层名,最终只会保存其一)");
	}
}

function deleteDocumentAncestorsMetadata () {
	var whatApp = String(app.name);
	if (whatApp.search("Photoshop") <= 0 || !documents.length) return;
	if (ExternalObject.AdobeXMPScript == undefined) ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
	var xmp = new XMPMeta(activeDocument.xmpMetadata.rawData);
	xmp.deleteProperty(XMPConst.NS_PHOTOSHOP, "DocumentAncestors");
	app.activeDocument.xmpMetadata.rawData = xmp.serialize();
}

function sortString (str) {
	var strlist = str.split("/");
	var tStr = "";
	for (var i = strlist.length - 1; i >= 0; i--) {
		tStr += strlist[i];
		if (i != 0) tStr += "/";
	}
	return tStr;
}

function layerName (layer) {
	return stripSuffix(trim(layer.name), ".png").replace(/[:\/\\*\?\"\<\>\|]/g, "");
}

function countAssocArray (obj) {
	var count = 0;
	for (var key in obj) if (obj.hasOwnProperty(key)) count++;
	return count;
}

function indexOf (array, value) {
	for (var i = 0, n = array.length; i < n; i++)
		if (array[i] == value) return i;
	return -1;
}

function trim (value) {
	return value.replace(/^\s+|\s+$/g, "");
}

function stripSuffix (str, suffix) {
	if (endsWith(str.toLowerCase(), suffix.toLowerCase())) str = str.substring(0, str.length - suffix.length);
	return str;
}

function startsWith (str, prefix) {
	return str.indexOf(prefix) === 0;
}

function endsWith (str, suffix) {
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function forwardSlashes (path) {
	return path.replace(/\\/g, "/");
}
