sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/m/MessageToast",
        "sap/ui/model/json/JSONModel",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/m/Dialog",
        "sap/m/MessageBox",
        "sap/ui/model/xml/XMLModel"
    ],
    function (
        Controller,
        MessageToast,
        JSONModel,
        Filter,
        FilterOperator,
        Dialog,
        MessageBox,
        XMLModel
    ) {
        "use strict";
        return Controller.extend("app.controller.App", {
            onInit: function () {
                MessageToast.show("ui5 app is ready")
             }
        })
    })
