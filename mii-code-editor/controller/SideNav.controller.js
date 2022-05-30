sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel"
], function (Controller,JSONModel) {
	"use strict";
	
	return Controller.extend("app.controller.SideNav", {
		onInit:function(){
			var oModel = new JSONModel(sap.ui.require.toUrl("app/model/tree.json"));
			console.log(oModel.getData())
			this.getView().setModel(oModel);
		},
		onItemSelectionChange:function(oEvent){
			var fileName = oEvent.getSource().getSelectedItem().getTitle()
			let lastIdex = fileName.lastIndexOf('.')
			let fileType = fileName.substr(lastIdex+1)
			let selectedItemPath = oEvent.getParameter('listItem').getBindingContext().getPath()
			var node = oEvent.getSource().getModel().getData()
			var filePath = this.getPath(node,selectedItemPath)
			console.log(filePath)
			if(!fileType){
				return
			}
			fileType = fileType.toLowerCase()
			var codeEditorView = sap.ui.getCore().byId('root').byId('idCodeView')
			console.log(codeEditorView)
			let type = 'javascript'

			switch(fileType){
				case 'irpt' || 'html':
					type = 'html'
					break;
				case 'js':
					type = 'javascript'
					break;
				case 'css':
					type = 'css'	
					break;
				case 'xml':
					type="xml"
					break	

			}
		
			console.log("type",type)
			var codeeditor = codeEditorView.byId('aCodeEditor')
			codeeditor.setType(type)
			$.ajax({
				url:"../model/code.json",
				success:function(oData){

					codeeditor.setValue(oData['8C_US/index.html'])
				}
			})
			
			debugger

		},
		getPath(node,path){
			var filePath = ''
			var heirarchy = path.split('/')
			heirarchy.shift()
			for(let i=0; i<heirarchy.length;i++){
				if(!node){
					break
				}
				if(heirarchy[i]=='nodes'){
					node = node.nodes
					continue
				}
				filePath = filePath+"/"+ node[heirarchy[i]].text
				node = node[heirarchy[i]].nodes
			}

			return filePath
		}
	});
});
