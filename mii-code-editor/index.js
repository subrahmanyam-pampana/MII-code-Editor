sap.ui.define([
    "sap/ui/core/mvc/XMLView"
], function(XMLView) {
    'use strict';
    
   XMLView.create({
       viewName:"app.view.App",
       id:"root"
   }).then(function(oview){
       oview.placeAt("content")
   })
});
