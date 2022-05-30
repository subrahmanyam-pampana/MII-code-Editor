sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/m/MessageToast",
        "sap/ui/model/json/JSONModel",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/m/Dialog",
        "sap/m/MessageBox",
        "sap/ui/model/xml/XMLModel",
        "sap/ui/codeeditor/CodeEditor"
    ],
    function (
        Controller,
        MessageToast,
        JSONModel,
        Filter,
        FilterOperator,
        Dialog,
        MessageBox,
        XMLModel,
        CodeEditor
    ) {
        "use strict";
        var oEditor; 
        var example1 = "function loadDoc() {\n\treturn 'bar';\n}";
    	var example2 = `.body{ 
		background-color: red;
		width: 100%;
		height: 10px;
		
	    }`;
        return Controller.extend("app.controller.CodeEditor", {
            onInit: function () {
            oEditor = this.byId("aCodeEditor");
			oEditor.setValue("// select tabs to see value of CodeEditor changing");
             },
             onSelectTab: function (oEvent) {
                var sFilterId = oEvent.getParameter("selectedKey");
                switch (sFilterId) {
                    case "js":
                        oEditor.setValue(example1);
                        oEditor.setType("javascript")
                        break;
                    case "css":
                        oEditor.setValue(example2);
                        oEditor.setType("css")
                        break;
                    case "xml":
                        oEditor.setValue(example2);
                        oEditor.setType("xml")
                        break;
                    default:
                        oEditor.setValue();
                        break;
                }
            }
        })
    })
