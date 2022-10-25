sap.ui.define([
	"sap/ui/core/UIComponent"
], function (UIComponent) {
	"use strict";

	return UIComponent.extend("miiCodeEditor.Component", {

		metadata : {
			interfaces: ["sap.ui.core.IAsyncContentCreation"],
			manifest: "json"
		},

		init : function () {
			UIComponent.prototype.init.apply(this, arguments);
			//test1

		}
	});

});
