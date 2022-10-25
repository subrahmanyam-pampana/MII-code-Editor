sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/TabContainerItem",
	"sap/m/MessageBox",
	"sap/ui/codeeditor/CodeEditor",
	"sap/ui/core/Fragment"

],                    

function (Controller, JSONModel, MessageToast, TabContainerItem, MessageBox, CodeEditor,Fragment) {
	"use strict";
	var QT = {
	    'servicesTrx':'Default/Subrahmanyam/MIICodeEditor/MIIServices'
	}
	var that;
	let sourceControlFolder;
	let isSaved = false;
	
	return Controller.extend("miiCodeEditor.controller.App",
	{

		_oCatalogModel: null,
		_oFilePropertiesModel: null,
		_oFilePropertiesHash: {},
		_oFilesTree: null,
		_oFilesTabContainer: null,
		_oFilesCodeEditor: null,
		_oFilesContentHash: {},
		_bIsIE: false,
		_isNewFile:false,
		onInit: function () {
		    that = this;
			jQuery(document).keydown(jQuery.proxy(function (oEvent) {
			    if (oEvent.keyCode === 83 && (oEvent.ctrlKey)) { 
			        oEvent.preventDefault(); 
			        this.onSave(); } }, this));

			this._oFilesTabContainer = this.getView().byId("filesTabContainer");
			this._oFilesTree = this.getView().byId("filesTree");
			this.getView().setModel(this._oFilePropertiesModel = new JSONModel(), "FileProperties");
			this.getView().setModel(this._oCatalogModel = new JSONModel({ path: "", parent: "" }), "Catalog");
			this.getCatalogListFolders("/");

			this._loadData('./configs.json').then(res=>{
			    sourceControlFolder = res.sourceCOntrolFolder
			})
		},
		getCatalogListFolders: function (sBindingPath) {
			this._oFilesTree.setBusy(true);
			var oNode = this._oCatalogModel.getProperty(sBindingPath);
			var that = this;
			jQuery.ajax({
				url: "/XMII/Catalog?Mode=ListFolders&Session=true&DoStateCheck=true&Content-Type=text/xml"
					+ "&Folder=" + oNode.path
					+ "&__=" + new Date().getTime(),
				type: "POST",
				success: function (data) {
					if (!that.fatalErrorHandler(data)) {
						var aNodes = [];
						jQuery("Row", data).each(function () {
							if (jQuery("IsWebDir", this).text() === "true") {
								aNodes.push({
									"title": jQuery("FolderName", this).text(),
									"path": jQuery("Path", this).text(),
									"parent": jQuery("ParentPath", this).text(),
									"IsWebDir": jQuery("IsWebDir", this).text(),
									"isFolder": true,
									"ListType": "Inactive",
									"nodes": [{}]
								});
							}
						});
						if (oNode.parent !== "") {
							that.getCatalogList(sBindingPath, aNodes, oNode.path);
							return;
						}
						that._oCatalogModel.setProperty(sBindingPath + "/nodes", aNodes);
					}
				},
				error: this.ajaxErrorHandler
			}).always(function () { that._oFilesTree.setBusy(false); });
		},
		getCatalogList: function (sBindingPath, aNodes, sFolderPath) {
			var that = this;
			jQuery.ajax({
				url: "/XMII/Catalog?Mode=List&Session=true&DoStateCheck=true&Content-Type=text/xml"
					+ "&Folder=" + sFolderPath
					+ "&__=" + new Date().getTime(),
				type: "POST",
				success: function (data) {
					if (!that.fatalErrorHandler(data)) {
						jQuery("Row", data).each(function () {
							aNodes.push({
								"title": jQuery("ObjectName", this).text(),
								"path": jQuery("FilePath", this).text(),
								"isFolder": false,
								"ListType": ((that.isFileTypeSupported(jQuery("ObjectName", this).text())) ? "Detail" : "Inactive")
							});
						});
						that._oCatalogModel.setProperty(sBindingPath + "/nodes", aNodes);
					}
				},
				error: this.ajaxErrorHandler
			}).always(function () { that._oFilesTree.setBusy(false); });
		},
		loadFile: function (sFullPath, oSource) {
			if (this.isFileTypeSupported(sFullPath)) {
				var that = this;
				jQuery.ajax({
					url: "/XMII/Catalog?Mode=LoadBinary&Class=Content&TemporaryFile=false&Content-Type=text/xml"
						+ "&ObjectName=" + sFullPath
						+ "&__=" + new Date().getTime(),
					type: "POST",
					success: function (data) {
						if (!that.fatalErrorHandler(data)) {
							that.addFilesTabContainerItem(sFullPath, data);
						}
					},
					error: this.ajaxErrorHandler
				}).always(function () { oSource.setBusy(false); });
				return;
			}
			oSource.setBusy(false);
		},
		isFileTypeSupported: function (sFullPath) {
			switch (sFullPath.split(".").pop()) {
				case "jpg": return false;
				case "png": return false;
				case "gif": return false;
				case "pdf": return false;
				default:
					return true;
			}
		},
		addFilesTabContainerItem: function (sFullPath, data,isNewFile=false) {

			var oTabContainerItem = new TabContainerItem({
				key: sFullPath
				, name: sFullPath.split("\\").pop().split("/").pop()
			});
		
			var _codeEditor =  new CodeEditor({ type: this.getEditorType(jQuery("Value:eq(1)", data).text()) })
					.setValue(this.b64DecodeUnicode(jQuery("Value:eq(2)", data).text()))
					.attachLiveChange(this.codeChangeHandler, this)
					
			that.getView().byId('code-viewer')
			        .setValue(this.b64DecodeUnicode(jQuery("Value:eq(2)", data).text()))
			that.getView().byId('code-viewer').setType(this.getEditorType(jQuery("Value:eq(1)", data).text()))        
			
			oTabContainerItem.addContent(_codeEditor);
				
			this._oFilesTabContainer.setSelectedItem(oTabContainerItem)
				.addItem(oTabContainerItem);
		},
		getEditorType: function (sFileType) {        
			switch (sFileType) {
				case "irpt":
					return "html";
				case "js":
					return "javascript";
				case "txt":
					return "text";
				default:
					return sFileType;
			}
		},
		getWebPath: function (sFullPath) {
			return "/XMII/CM/" + sFullPath.replace("/WEB", "");
		},
		codeChangeHandler: function () {
			var oTabContainerItem = sap.ui.getCore().byId(this._oFilesTabContainer.getSelectedItem());
			if (oTabContainerItem && !oTabContainerItem.getModified()) {
				oTabContainerItem.setModified(true);
			}
		},
		onToggleOpenState: function (oEvent) {
			var sPath = oEvent.getParameter("itemContext").getPath();
			if (oEvent.getParameter("expanded") && this._oCatalogModel.getProperty(sPath).isFolder) {
				this.getCatalogListFolders(sPath);
			}
		},
		onDetailPress: function (oEvent) {
			oEvent.getSource().setBusy(true);
			var oNode = this._oCatalogModel.getProperty(oEvent.getSource().getBindingContext("Catalog").getPath());
			var sFullPath = oNode.path + "/" + oNode.title;
			var aTabItems = this._oFilesTabContainer.getItems();

			for (var x in aTabItems) {
				if (aTabItems[x].getKey() === sFullPath) {
					this._oFilesTabContainer.setSelectedItem(aTabItems[x]);
					oEvent.getSource().setBusy(false);
					return;
				}
			}
			this.loadFile(sFullPath, oEvent.getSource());
		},
		onSelect: function (oEvent) {

			try { var sFilePath = oEvent.getParameter("item").getKey();
			
			    let sId = oEvent.getSource().getSelectedItem()
		    	let content = sap.ui.getCore().byId(sId).getContent()[0].getCurrentValue()
		    	let type = sap.ui.getCore().byId(sId).getContent()[0].getType()
			    this.getView().byId('code-viewer').setValue(content)
			    this.getView().byId('code-viewer').setType(type)
			    
			} catch (e) { return; }
			

			var propertyData = this._oFilePropertiesHash[sFilePath];
			this._oFilePropertiesModel.setData(propertyData);
			if (!propertyData && !this._isNewFile) {
				var that = this;
				jQuery.ajax({
					url: "/XMII/Catalog?Mode=ListFileProperties&Content-Type=text/xml"
						+ "&ObjectName=" + sFilePath
						+ "&__=" + new Date().getTime(),
					type: "POST",
					success: function (data) {
						if (!that.fatalErrorHandler(data)) {
							propertyData = [];
							jQuery("Row", data).children().each(function () {
								propertyData.push({ "Name": this.nodeName, "Value": jQuery(this).text() });
							});
							that._oFilePropertiesHash[sFilePath] = propertyData;
							that._oFilePropertiesModel.setData(propertyData);
						}
					},
					error: this.ajaxErrorHandler
				});
			}
			
		},
		onClose: function (oEvent) {
			delete this._oFilesContentHash[oEvent.getParameter("item").getKey()];
			delete this._oFilePropertiesHash[oEvent.getParameter("item").getKey()];
			if (this._oFilesTabContainer.getItems().length <=1) {
				this._oFilePropertiesModel.setData([]);
				this.getView().byId('code-viewer').setValue('')
			}else{
			    let selectedItem = sap.ui.getCore().byId(this._oFilesTabContainer.getSelectedItem())
			    
			    this.getView().byId('code-viewer').setValue(selectedItem.getContent()[0].getCurrentValue())
			    
			}
		
		},
		onSave: function () {
			var oTabContainerItem = sap.ui.getCore().byId(this._oFilesTabContainer.getSelectedItem());
			var b64Content; 
			
			if (oTabContainerItem) { 
			
				b64Content = this.b64EncodeUnicode(oTabContainerItem.getContent()[0].getCurrentValue());
				if(!b64Content){
				    MessageBox.warning("Can't save empty file")
				    return
				}
			
				this._oFilesTabContainer.setBusy(true);
				var that = this;
				jQuery.ajax({
					url: "/XMII/Catalog?Mode=SaveBinary&Class=Content"
						+ "&ObjectName=" + oTabContainerItem.getKey()
						+ "&__=" + new Date().getTime(),
					type: "POST",
					data: jQuery.param({ Content: b64Content }),
					contentType: "application/x-www-form-urlencoded; charset=UTF-8",
					success: function (data) {
						if (!that.fatalErrorHandler(data)) {
						
							delete that._oFilePropertiesHash[oTabContainerItem.getKey()];
							//that._oFilesTabContainer.setSelectedItem(oTabContainerItem);
							that._oFilesTabContainer.setBusy(false);
							MessageToast.show(jQuery("Message", data).text(), { my: sap.ui.core.Popup.Dock.CenterBottom });
							
				// 			oTabContainerItem.setModified(false);
				// 			isSaved = true;
						   	that._isNewFile = false
						}else{
						    that._oFilesTabContainer.setBusy(false);
						}
					},
					error: this.ajaxErrorHandler
				});
			
			}	
			
		},
		onRun: function () {
			var oTabContainerItem = sap.ui.getCore().byId(this._oFilesTabContainer.getSelectedItem());
			let path = oTabContainerItem.getKey().replace('/WEB', '')
			var url = `${window.location.origin}/XMII/CM/${path}`
			window.open(url, '_blank')
		},
		isFileOpen:function(sFilePath){
		    for(let tab of this._oFilesTabContainer.getItems()){
		        if(tab.getKey() === sFilePath){
		            return tab
		        }
		    }
		    
		    return false
		},
		createFile: function (oEvent) {
		    let context = oEvent.getSource().getBindingContext("Catalog")
			var path = context.getPath()
			var oNode = this._oCatalogModel.getProperty(path);
			if(!oNode.IsWebDir){
			    MessageBox.warning("Can not create file inside another file!")
			    return
			}
			    
			
			
			this._isNewFile = true

			let saveName = (name) => {
			    
			    if(!that.isFileTypeSupported(name)){
			        MessageBox.warning("File type not supported!")
			        retun;
			    }
			    
				oNode.nodes.push({
					"title": name,
					"path": oNode.path,
					"parent": oNode.path,
					"IsWebDir": "false",
					"isFolder": false,
					"ListType": "Detail"
				})
				that._oCatalogModel.setProperty(path, oNode)
			    that.addFilesTabContainerItem(oNode.path + '/' + name, '')
			}

			let oInput = new sap.m.Input({
				placeholder: 'Enter File Name'

			})

			let oDialog = new sap.m.Dialog({
				title: 'file Name',
				content: [oInput],
				beginButton: new sap.m.Button({
					text: 'Ok',
					press: () => {
						saveName(oInput.getValue())
						oDialog.close()
					}
				}),
				endButton: new sap.m.Button({
					text: 'cancel',
					press: () => {
						oDialog.close()
					}
				})
			})

			oDialog.open()

		},
		_getFileData:function(sFullPath){
		   return new Promise((resolve,reject)=>{
		        
		      if (this.isFileTypeSupported(sFullPath)) {
				jQuery.ajax({
					url: "/XMII/Catalog?Mode=LoadBinary&Class=Content&TemporaryFile=false&Content-Type=text/xml"
						+ "&ObjectName=" + sFullPath
						+ "&__=" + new Date().getTime(),
					type: "POST",
					success: function (data) {
					   let decodedData = that.b64DecodeUnicode($(data).find('Value:eq(2)').text())
						resolve(decodedData);
					},
					error: that.ajaxErrorHandler
				})
			}else{
			    MessageBox.warning("file format not supported")
			}
  
		    })
		
			
		},
		createFolder: function (oEvent) {
		    let context = oEvent.getSource().getBindingContext("Catalog")
        	var path = context.getPath()
			var oNode = this._oCatalogModel.getProperty(path);
			if(!oNode.IsWebDir){
			    MessageBox.warning("Can not create folder inside another file!")
			    return
			}
			
			var that = this;
		
            let saveName = (name) => {
				
				that._oCatalogModel.setProperty(path, oNode)
				
				jQuery.ajax({
					url: `/XMII/Runner?Transaction=${QT.servicesTrx}&OutputParameter=*&Content-Type=text/xml`+
					"&__=" + new Date().getTime(),
					type: "POST",
					data: {path:oNode.path+'/'+name,type:'CreateFolder'},
					success: function (data) {
						if (!that.fatalErrorHandler(data)) {
						    that.getView().byId("filesTree").fireToggleOpenState({
						        itemContext:context,
						        expanded:true
						    })
						}else{
						    that._oFilesTabContainer.setBusy(false);
						}
					},
					error: this.ajaxErrorHandler
				});
			}

			let oInput = new sap.m.Input({
				placeholder: 'Enter Folder Name'

			})

			let oDialog = new sap.m.Dialog({
				title: 'Folder Name',
				content: [oInput],
				beginButton: new sap.m.Button({
					text: 'Ok',
					press: () => {
						saveName(oInput.getValue())
						oDialog.close()
					}
				}),
				endButton: new sap.m.Button({
					text: 'cancel',
					press: () => {
						oDialog.close()
					}
				})
			})

			oDialog.open()
		},
		deleteFile: function (oEvent) {
		    let context = oEvent.getSource().getBindingContext("Catalog")
		    var oNode = context.getObject()
		    var sPath = oEvent.getSource().getBindingContext("Catalog").getPath()
		    let filePath = oNode.path
		    
		    filePath += (oNode.IsWebDir=='true')? '':'/'+oNode.title;
		    
            MessageBox.confirm("Are you sure you want to delete file "+oNode.title,
    		    {
    		      onClose:(sAction)=>{
    		        if(sAction==='OK'){
    		            
    		            that._deleteFile(filePath).then(response=>{
    		                that._oCatalogModel.setProperty(sPath,null)
    					        var tab = that.isFileOpen(filePath)
    					        if(tab){
    					            that._oFilesTabContainer.removeItem(tab)
    					        }
    
    		            })
    		          } 
    		        }
    		    })
    		   
		},
		_deleteFile:function(filePath){
		    return new Promise((resolve,reject)=>{
		        $.ajax({
		            url:`/XMII/Runner?Transaction=${QT.servicesTrx}&OutputParameter=*&Content-Type=text/xml`+
					"&__=" + new Date().getTime(),
					type:"POST",
					data:{
					    type:'deleteFile',
					    path:filePath
					},
					success:function(xmlData){
					    if(!that.fatalErrorHandler(xmlData)){
					        MessageToast.show("file deleted Successfully!")
					        resolve(xmlData)
					        
					    }
					},
					error:that.ajaxErrorHandler
		        })
		    })
		    
		},
		
		rename: function (oEvent) {
		    let oNode = oEvent.getSource().getBindingContext("Catalog").getObject()
		    let sPath = oEvent.getSource().getBindingContext("Catalog").getPath()
		    let oldFilePath = oNode.path+'/'+oNode.title
		    
		    if(oNode.IsWebDir==='true'){
		        MessageBox.error("Con't change the folder name")
		        return
		    }
		    
		    let oInput = new sap.m.Input({
				placeholder: 'Enter File Name',
		        value:oNode.title
		    })
		    let saveName = (name)=>{
		        if(!that.isFileTypeSupported(name)){
		            MessageBox.warning("File Name not Supported")
		            return
		        }
		        
		        
		        that._getFileData(oldFilePath).then(content=>{
		            console.log(content)
		            that._deleteFile(oldFilePath).then(res=>{
		                that._saveFile(oNode.path+'/'+name,content).then(res2=>{
    		                    that._oCatalogModel.setProperty(sPath+'/title', name)
                		        var tab = that.isFileOpen(oldFilePath)
                		        if(tab){
                		            that._oFilesTabContainer.removeItem(tab)
                		        }
                		        
		                })
		            })
		        })
		        
		        
		        
		    }
		    
            let oDialog = new sap.m.Dialog({
				title: 'file Name',
				content: [oInput],
				beginButton: new sap.m.Button({
					text: 'Ok',
					press: () => {
						saveName(oInput.getValue())
						oDialog.close()
					}
				}),
				endButton: new sap.m.Button({
					text: 'cancel',
					press: () => {
						oDialog.close()
					}
				})
			})
			
			oDialog.open()
		},
		copyFile: function (oEvent) {
            let oNode = oEvent.getSource().getBindingContext("Catalog").getObject()
		    let sPath = oEvent.getSource().getBindingContext("Catalog").getPath()
		    let filePath = oNode.path+'/'+oNode.title
		    
		    navigator.clipboard.writeText(filePath).then(function() {
               
                 MessageToast.show('file copied to clip board')
            }, function(err) {
                console.error('Async: Could not copy text: ', err);
            });
		},
		pasteFile: function (oEvent) {
		    let context = oEvent.getSource().getBindingContext("Catalog")
            let oNode = context.getObject()
		    let sPath = oEvent.getSource().getBindingContext("Catalog").getPath()
		    let parentFolderPath = oNode.path
		    
		    if(!oNode.IsWebDir){
			    MessageBox.warning("Can not paste file inside another file!")
			    return
			}
		    
		    navigator.clipboard.readText().then(filePath=>{
		        let fileName = filePath.split('/').slice(-1)[0]
		        
		        
		        
		        that._getFileData(filePath).then(content=>{
		           
		           that._saveFile(parentFolderPath+'/'+fileName,content).then(res=>{
		               that.getView().byId("filesTree").fireToggleOpenState({
		                   itemContext:context,
		                   expanded:true
		               })
		           })
		         
		        })
		        
		    })
		},
		_saveFile:function(filePath, content){
		    let b64Content = that.b64EncodeUnicode(content);
		    return new Promise((resolve,reject)=>{
		        $.ajax({
					url: "/XMII/Catalog?Mode=SaveBinary&Class=Content"
						+ "&ObjectName=" +filePath
						+ "&__=" + new Date().getTime(),
					type: "POST",
					data: jQuery.param({ Content: b64Content }),
					contentType: "application/x-www-form-urlencoded; charset=UTF-8",
					success: function (data) {
						if (!that.fatalErrorHandler(data)) {
						    MessageToast.show("File saved Successfully")
						    resolve(data)
						}
					},
					error: that.ajaxErrorHandler
				});  
		        
		        
		    })
		    
		},
		createView:{
		    
    		 context:'',
    		 onCreate: function (oEvent) {
    		    this.context = oEvent.getSource().getBindingContext("Catalog")  
    		    let oNode = this.context.getObject()
    		    let parentFolderPath = oNode.path
    		    
    		     if(!oNode.IsWebDir){
			        MessageBox.warning("Can not create view file inside another file!")
			        return
			     }
    		    
    		    if(!this.pViewDialog){
    		               this.pViewDialog =  that.loadFragment({
    		                name:"miiCodeEditor.view.viewDialog"
    		            })
    		        
    		    }
    		    this.pViewDialog.then(oDialog=>{
    		         oDialog.setModel(new JSONModel({
    		              viewName:'',
    		              controllerName:'',
    		              parentFolderPath:parentFolderPath
    		                   }))
    		           oDialog.open()
    		          })
    
    		 },
    		createFile:function(oEvent){
    		    
    		    let oDialog = that.getView().byId("view-dialog")
    			oDialog.close()
    			let thisRef = this
    			let oData = oDialog.getModel().getData() 
    
    			 $.ajax({
    		        url:'./metaData/view.txt',
    		        success:function(sViewContent){
    		           sViewContent = sViewContent.replaceAll("#controllerName#",oData.controllerName)
    		           that._saveFile(oData.parentFolderPath+'/'+oData.viewName+'.view.xml',sViewContent).then(data=>{
    		                    that.getView().byId("filesTree").fireToggleOpenState({
            						   itemContext:thisRef.context,
            						   expanded:true
            					})
    		           })
    		           
    		        }
    		    })
    		},
    		closeDialog:function(){
    		    that.getView().byId("view-dialog").close()
    		}
		},
		createController:{
		    parentFolderPath:'',
		    oModel: '',
		    context:'',
		    oDialog:'',
		    onCreate: function (oEvent) {
		         this.context = oEvent.getSource().getBindingContext("Catalog")
                 let oNode = this.context.getObject()
                 
                 if(!oNode.IsWebDir){
			        MessageBox.warning("Can not create controller file inside another file!")
			        return
			     }
			     
                 this.oModel = new JSONModel({
        		              controllerName:'',
        		              controllerPath:'',
        		              modules:[{module:'sap/m/MessageToast',component:'MessageToast'},
        		                       {module:'sap/m/MessageBox',component:'MessageBox'}]
        		                   })
        		                   
                 let oModel = this.oModel
    		     this.parentFolderPath = oNode.path
    		    
        		    if(!this.pDialog){
        		               this.pDialog =  that.loadFragment({
        		               name:"miiCodeEditor.view.controllerDialog"
        		            })
        		        
        		    }
        		    this.pDialog.then(oDialog=>{
        		        this.oDialog = oDialog
        		         oDialog.setModel(oModel)
        		         oDialog.open()
        		   })
        
    		},
		    createFile:function(){
		       let parentFolderPath =  this.parentFolderPath 
			   let sModules = ""
		       let sModuleRef = ""
		   	   let oData = this.oModel.getData()
		   	   let thisRef = this;
		   	   let oComboBox = that.getView().byId('id-selected-modules')
		   	   let selectedModules = oComboBox.getSelectedItems()
		   	   
		   	   selectedModules.forEach((item,i)=>{
				    let obj = item.getBindingContext().getObject()
		   	        sModules += `'${obj.module}'`
		   	        sModules += (i!==selectedModules.length-1)?',':''
		            sModuleRef += obj.component
		            sModuleRef += (i!==oData.modules.length-1)?',':''
		   	   })
		   	   
		   	   oComboBox.removeAllSelectedItems()
		   	   
		       $.ajax({
    		        url:'./metaData/controller.txt',
    		        success:function(sContent){
    		          
    		           sContent = sContent.replaceAll("#modules#",sModules)
    		           sContent = sContent.replaceAll("#modules-ref#",sModuleRef)
    		           sContent = sContent.replaceAll("#Controller-ref#",oData.controllerPath)
    		           
    		           that._saveFile(parentFolderPath+'/'+oData.controllerName+'.controller.js',sContent).then(data=>{
    		               thisRef.oDialog.close()
    		               that.getView().byId("filesTree").fireToggleOpenState({
    						   itemContext:thisRef.context,
    						   expanded:true
					       })
    		           })
    		           
    		        }
		         })
	    	},
	    	
	    	closeDialog:function(){
    		   this.oDialog.close() 
    		}
	    	
		
		},
		
		createFragment:{
		    
    		 context:'',
    		 parentFolderPath:'',
    		 onCreate: function (oEvent) {
    		    this.context = oEvent.getSource().getBindingContext("Catalog")  
    		    let oNode = this.context.getObject()
    		     if(!oNode.IsWebDir){
			        MessageBox.warning("Can not create Fragment file inside another file!")
			        return
			     }
    		    
    		    this.parentFolderPath = oNode.path
    		    
    		    if(!this.pFragDialog){
    		               this.pFragDialog =  that.loadFragment({
    		                name:"miiCodeEditor.view.fragmentDialog"
    		            })
    		        
    		    }
    		    this.pFragDialog.then(oDialog=>{
    		         oDialog.setModel(new JSONModel({
    		              fragmentName:''
    		           }))
    		           oDialog.open()
    		          })
    
    		 },
    		createFile:function(oEvent){
    		    let oDialog = that.getView().byId("fragment-dialog")
				
    			let thisRef = this
    			let oData = oDialog.getModel().getData() 
    
    			 $.ajax({
    		        url:'./metaData/fragment.txt',
    		        success:function(sContent){
    		           
    		           that._saveFile(thisRef.parentFolderPath+'/'+oData.fragmentName+'.fragment.xml',sContent).then(data=>{
    		                    that.getView().byId("filesTree").fireToggleOpenState({
            						   itemContext:thisRef.context,
            						   expanded:true
            					})
            					
            					oDialog.close()
    		           })
    		           
    		        }
    		    })
    		},
    		closeDialog:function(){
    		    that.getView().byId("fragment-dialog").close()
    		}

		},
		createBasicApp:{
		      //create index.html page 
		      //create index.js file
		      //create view
		      //create controller

		},
		createFioriApp:{
            onCreate:function(oEvent){
                this.context = oEvent.getSource().getBindingContext("Catalog")  
    		    let oNode = this.context.getObject()
    		    this.parentFolderPath = oNode.path
    		    
    		     if(!oNode.IsWebDir){
			        MessageBox.warning("Can not create Ui5 App inside another file!")
			        return
			     }
    		    
                let thisRef = this
    		    if(!this.pAppDialog){
    		               this.pAppDialog =  that.loadFragment({
    		                name:"miiCodeEditor.view.fioriApp"
    		            })
    		         
    		    }
    		    this.pAppDialog.then(oDialog=>{
    		         oDialog.setModel(new JSONModel({
    		              appTitle:'',
    		              appDescription:'',
    		              appName:'',
    		              appRef:'',
    		              viewName:'' ,
    		              controllerName:''
    		           }))
    		         oDialog.open()
    		         thisRef.oDialog = oDialog
    		      })
          } ,
          createApp:function(){
             let data = this.oDialog.getModel().getData()
             let thisRef = this
             this.oDialog.setBusy(true)
             //1.create html file
             that._loadData('./metaData/html.txt').then(content=>{
                 
                 content =  content.replaceAll("#title#", data.appTitle)
                                .replaceAll("#app-ref#",data.appRef)
                                .replaceAll("#app-ref#",data.appRef)
                                
                that._saveFile(`${thisRef.parentFolderPath}/${data.appName}/webapp/index.html`,content).then(res1=>{
                    
                    //2.create component file
                    that._loadData('./metaData/component.txt').then(content=>{
                 
                         content =  content.replaceAll("#app-ref#",data.appRef)
                         that._saveFile(`${thisRef.parentFolderPath}/${data.appName}/webapp/Component.js`,content)                
                    })
                    
                    //3.create manifest file
                    that._loadData('./metaData/manifest.txt').then(content=>{
                         
                        content =  content.replaceAll("#app-ref#",data.appRef)
                                       
                        that._saveFile(`${thisRef.parentFolderPath}/${data.appName}/webapp/manifest.json`,content)                
                    })
                    
                    //4.create view file
                    that._loadData('./metaData/view.txt').then(content=>{
                 
                         content =  content.replaceAll("#controllerName#",`${data.appRef}.controller.${data.controllerName}`)
                         that._saveFile(`${thisRef.parentFolderPath}/${data.appName}/webapp/view/${data.viewName}.view.xml`,content)                
                    })
                    
                    //5.create controller file
                     that._loadData('./metaData/controller.txt').then(Content=>{
                         
                        Content =  Content.replaceAll("#Controller-ref#",`${data.appRef}.controller.${data.controllerName}`)
                                   .replaceAll("#modules#",'')
                                   .replaceAll("#modules-ref#",'')
                                       
                        that._saveFile(`${thisRef.parentFolderPath}/${data.appName}/webapp/controller/${data.controllerName}.controller.js`,Content)
                     })
                     
                             
                    //6.create i18n file 
                     that._loadData('./metaData/i18n_properties.txt').then(Content=>{
                         
                        Content =  Content.replaceAll("#appTitle#",data.appTitle)
                                   .replaceAll("#appDescription#",data.appDescription)
                                  
                        that._saveFile(`${thisRef.parentFolderPath}/${data.appName}/webapp/i18n/i18n.properties`,Content).then(data=>{
                             thisRef.oDialog.setBusy(false)
                             thisRef.oDialog.close()
                             that.getView().byId('filesTree').fireToggleOpenState({
                                      itemContext:thisRef.context,
                                      expanded:true
                                     })
                        })               
                        
                    })
                     
                })                
            })
            
          },
          closeDialog:function(){
              this.oDialog.close()
          }
		},
		_loadData:function(url){
		    return new Promise((resolve)=>{
		         $.ajax({
		        url:url,
		        contentType:'text/json',
		        success:function(data){
		            resolve(data)
		        },
		        
		        error: that._ajaxErrorHandler
		        })
		    })
		   
		},

		fatalErrorHandler: function (data) {
			if (jQuery("FatalError", data).text() !== "") {
				MessageBox.error(jQuery("FatalError", data).text());
				return true;
			}
			return false;
		},
		ajaxErrorHandler: function (jqXHR, textStatus, errorThrown) {
			MessageBox.error(textStatus + " " + errorThrown);
		},
		b64DecodeUnicode: function (str) {

			return decodeURIComponent(Array.prototype.map.call(window.atob(str.replace(/\s/g, '')), function (c) {
				return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
			}).join(""))

		},
		b64EncodeUnicode: function (str) {
			return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
				return String.fromCharCode(parseInt(p1, 16))
			}))
		},
		sourceControl:{
		     content:'',
		     commitModel:'', 
		   
		     openDialog:function(){
                var sTabId = that._oFilesTabContainer.getSelectedItem() 
                var thisRef = this;
                if(!sTabId){
                    MessageBox.warning("Please open the file to commit the changes")
                    return
                }
                var oTab = sap.ui.getCore().byId(sTabId)
                thisRef.content = oTab.getContent()[0].getValue()
                thisRef.filePath = sourceControlFolder+'/'+oTab.getKey()
                                    .replaceAll('/','_')
                                    .replaceAll('.','_')+'.json'
                
                that._getFileData(thisRef.filePath).then(fileContent=>{
                     if(!fileContent){
                        fileContent=[]
                    }
                    else{
                        fileContent = JSON.parse(fileContent) 
                    }
                    
                    thisRef.fileContent = fileContent
                    
                    thisRef.commitModel = new JSONModel({
                       filePath:oTab.getKey(),
                       version: (fileContent.length>0)?(parseFloat(fileContent[fileContent.length-1].version)+0.1).toFixed(1): 0.1,
                       message:''
                    })
                    if(!thisRef.pCommitDialog){
                        thisRef.pCommitDialog = that.loadFragment({
                            name:"miiCodeEditor.view.commitFragment"
                        })
                    }
                    
                    thisRef.pCommitDialog.then(oDialog=>{
                        oDialog.setModel(this.commitModel)
                        oDialog.open()
                        thisRef.commitDialog = oDialog
                    })
            
             }) 
             
           },
             commitChanges:function(){
                 console.log("saving the file.....")
                 let modelData = this.commitModel.getData() 
                 let thisRef = this;
                 thisRef.fileContent.push({
                     ...modelData,
                     user:'subrahmanyam',
                     data: that.b64EncodeUnicode(thisRef.content), 
                     dateTime: new Date().toUTCString()
                 })  
                 that._saveFile(thisRef.filePath,JSON.stringify(thisRef.fileContent)).then(res=>{
                     console.log("commited")
                      thisRef.commitDialog.close()
                 })  
           },
             closeDialog:function(){
               this.commitDialog.close()
              },
         
              
		},
		versions:{
		     openDialog:function(){
                var sTabId = that._oFilesTabContainer.getSelectedItem() 
                var thisRef = this;
                if(!sTabId){
                    MessageBox.warning("Please open the file to view the versions")
                    return
                }
                var oTab = sap.ui.getCore().byId(sTabId)
                thisRef.content = oTab.getContent()[0].getValue()
                thisRef.filePath = sourceControlFolder+'/'+oTab.getKey()
                                    .replaceAll('/','_')
                                    .replaceAll('.','_')+'.json'
                
                that._getFileData(thisRef.filePath).then(fileContent=>{
                     if(!fileContent){
                        fileContent=[]
                    }
                    else{
                        fileContent = JSON.parse(fileContent) 
                    }
                    
                    thisRef.fileContent = fileContent
                    
                    thisRef.versionModel = new JSONModel( thisRef.fileContent)
                    if(!thisRef.pVerDialog){
                        thisRef.pVerDialog = that.loadFragment({
                            name:"miiCodeEditor.view.versions"
                        })
                    }
                    
                    thisRef.pVerDialog.then(oDialog=>{
                        oDialog.setModel(thisRef.versionModel)
                        oDialog.open()
                        thisRef.Dialog = oDialog
                    })
            
             })
		    
		},
		 closeDialog:function(){
		    this.Dialog.close() 
	    },
	    viewCode:function(oEvent){
	        let dataObj = oEvent.getSource().getBindingContext().getObject()
			this.getView().byId("code-viewer").setValue(this.b64DecodeUnicode(dataObj.data))
			this.Dialog.close()
			that._setSplitterWidth(['20%','40%','40%'])
			
	    }
	
	},
	_setSplitterWidth:function(aWidths){
	    let splitter =  this.getView().byId("contentSplitter")
	    splitter.getContentAreas()[0].getAggregation('layoutData').setSize('60%')
		splitter.getContentAreas().forEach((item,i)=>{
			item.getAggregation('layoutData').setSize(aWidths[i])
		})
	    
	}
	
})

});



