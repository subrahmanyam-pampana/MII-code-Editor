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
	var QT = {}; 
	var that;
	let isSaved = false;
	let userName = $('#CD_USER').val()
	let copiedFilePath
	let codeViewer;
	let modules = []
	let oFilesTabContainerModel= new JSONModel()
	
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
		onInit: function () {
		   
		    that = this;
		    that.addKeyBoardShortCuts()
			
			this._oFilesTabContainer = this.getView().byId("filesTabContainer");
			this._oFilesTree = this.getView().byId("filesTree");
			this.getView().setModel(this._oFilePropertiesModel = new JSONModel(), "FileProperties");
			this.getView().setModel(this._oCatalogModel = new JSONModel({ path: "", parent: "" }), "Catalog");
			this.getCatalogListFolders("/");

			this._loadData('./configs.json').then(res=>{QT = res })
			this._loadData('./metaData/modules.json').then(res=>{modules = res })
			
			oFilesTabContainerModel.setData({
			    tabs:[
			       // {name:'test',key:'key-1',code:'var',type:'javascript',colorTheme:'tomorrow_night'}
			        ]
			})
			
			this._oFilesTabContainer.setModel(oFilesTabContainerModel)
			
		},
		addKeyBoardShortCuts:function(){
		    
		    jQuery(document).keydown(jQuery.proxy(function (oEvent) {
		        
			    if (oEvent.keyCode === 83 && (oEvent.ctrlKey)) { 
			        oEvent.preventDefault(); 
			        that.onSave(); 
			    }
			     
		    }, this))
		    
		    
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
		    
		    return new Promise((resolve,reject)=>{
		        
		       if (this.isFileTypeSupported(sFullPath)) {
				var that = this;
				jQuery.ajax({
					url: "/XMII/Catalog?Mode=LoadBinary&Class=Content&TemporaryFile=false&Content-Type=text/xml"
						+ "&ObjectName=" + sFullPath
						+ "&__=" + new Date().getTime(),
					type: "POST",
					success: function (data) {
						if (!that.fatalErrorHandler(data)) {
							resolve(data)
						}else{
						    reject(data)
						}
					},
					error: this.ajaxErrorHandler
				}).always(function () { oSource.setBusy(false); });
				return;
			} 
		    })
		    
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
		addFilesTabContainerItem: function (sFullPath, data,oParentFolderCtx= undefined,bNewFile) {

			var tabsData = oFilesTabContainerModel.getData()
			
			let isExist = ()=>{
			    for(let tab of tabsData.tabs){
    			    if(tab.name===sFullPath){
    			        return true
    			        break
    			     }
		    	}
		    	return false
			}
			
			let getIndex = ()=>{
			    let i=0;
			    for(let tab of tabsData.tabs){
			        if(tab.name === sFullPath){
			            return i
			        }
			        
			        i++
			    }
			    
			    return -1
			}
			
			
			if(isExist()){
			    
			    //selecting current item
			    this._oFilesTabContainer.setSelectedItem(this._oFilesTabContainer.getItems()[getIndex()])
			    
			  }else{
			      
			     tabsData.tabs.push(
			      { name:sFullPath.split("\\").pop().split("/").pop(),
			        key: sFullPath, 
			        code: that.b64DecodeUnicode(jQuery("Value:eq(2)", data).text()),
			        type: that.getEditorType(jQuery("Value:eq(1)", data).text()),
			        colorTheme:'tomorrow_night',
			        parentContext:oParentFolderCtx,
			        newFile:bNewFile
			        
			    })
			    
			    oFilesTabContainerModel.refresh()
			    this._oFilesTabContainer.setSelectedItem(this._oFilesTabContainer.getItems()[tabsData.tabs.length-1])
			    
			}
			
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
		onToggleOpenState: function (oEvent) {
			var sPath = oEvent.getParameter("itemContext").getPath();
			if (oEvent.getParameter("expanded") && this._oCatalogModel.getProperty(sPath).isFolder) {
				this.getCatalogListFolders(sPath);
			}
		},
		onDetailPress: function (oEvent) {
		    
		    var treeItem = oEvent.getSource()
		    treeItem.setBusy(true);
		    
			var oNode = this._oCatalogModel.getProperty(oEvent.getSource().getBindingContext("Catalog").getPath());
			var sFullPath = oNode.path + "/" + oNode.title;
			var aTabItems = this._oFilesTabContainer.getItems();

			for (var x in aTabItems) {
				if (aTabItems[x].getKey() === sFullPath) {
					this._oFilesTabContainer.setSelectedItem(aTabItems[x]);
					treeItem.setBusy(false);
					return;
				}
			}
			
			this.loadFile(sFullPath, oEvent.getSource()).then(data=>{
			    that.addFilesTabContainerItem(sFullPath, data,undefined,false);
			    that._setFileProperties(sFullPath)
			    
			}).catch(error=>{
			    console.log(error)
			}).finally(()=>{
			    treeItem.setBusy(false)
			})
		},
		/**
		 * This function do following tasks
		 * 1. gets the file properties  
		 * 2. sets the data to fileProperties model
		 * 3. hashes the result
		 * @Param{String} sFilePath - full path of the file
		 * @Return{Object} propertyData - properties data
		*/
		_setFileProperties:function(sFilePath){
		    return new Promise((resolve,reject)=>{
		        
		        jQuery.ajax({
					url: "/XMII/Catalog?Mode=ListFileProperties&Content-Type=text/xml"
						+ "&ObjectName=" + sFilePath
						+ "&__=" + new Date().getTime(),
					type: "POST",
					success: function (data) {
						if (!that.fatalErrorHandler(data)) {
						    
						    var propertyData = [];
							jQuery("Row", data).children().each(function () {
								propertyData.push({ "Name": this.nodeName, "Value": jQuery(this).text() });
							});
							that._oFilePropertiesHash[sFilePath] = propertyData;
							that._oFilePropertiesModel.setData(propertyData);
							
							resolve(propertyData)
						}else{
						    reject(data)
						}
					},
					error: this.ajaxErrorHandler
				});
		        
		    })
		    
		},
		onSelect: function (oEvent) {
		    if(!oEvent.getParameter("item")) return;
		    var tabObj = oEvent.getParameter("item").getBindingContext().getObject()
		    var sFilePath = oEvent.getParameter("item").getKey();
		    var propertyData = this._oFilePropertiesHash[sFilePath];
		    
            if (!propertyData && !tabObj.newFile) {
				that._setFileProperties(sFilePath)
			}else{
			    this._oFilePropertiesModel.setData(propertyData);
			}
			
		},
		_removeTab:function(oSourceItem){
		    let index = this._oFilesTabContainer.indexOfItem(oSourceItem)
			oFilesTabContainerModel.getData().tabs.splice(index,1)
			
			oFilesTabContainerModel.refresh()
		},
		onClose: function (oEvent) {
			delete this._oFilesContentHash[oEvent.getParameter("item").getKey()];
			delete this._oFilePropertiesHash[oEvent.getParameter("item").getKey()];
			
			let removedObj = oEvent.getParameter('item').getBindingContext().getObject()
			this._removeTab(oEvent.getParameter('item'))
			
			if(removedObj.newFile){
    			 this._oFilesTree.fireToggleOpenState({
    					itemContext:removedObj.parentContext,
        	            expanded:true
    			 })
    			 
			}
			
			if(this._oFilesTabContainer.getItems().length ===0){
			    this._oFilePropertiesModel.setData([])
			    this._oFilePropertiesHash = {}
			}
		
		},
		onSave: function () {
		   
			var oTabContainerItem = sap.ui.getCore().byId(this._oFilesTabContainer.getSelectedItem());
			var b64Content; 
			
			if (oTabContainerItem) { 
			    var tabObj = oTabContainerItem.getBindingContext().getObject()
				// b64Content = this.b64EncodeUnicode(oTabContainerItem.getContent()[0].getCurrentValue());
				if(!tabObj.code){
				    MessageBox.warning("Can't save empty file")
				    return
				}
			   
				this._oFilesTabContainer.setBusy(true);
				
				let sFilePath = tabObj.key
				
				that._saveFile(sFilePath,tabObj.code).then(data=>{
				    
		            delete that._oFilePropertiesHash[sFilePath];
					
					MessageToast.show(jQuery("Message", data).text(), { my: sap.ui.core.Popup.Dock.CenterBottom });
					
					that._setFileProperties(sFilePath)
					
					if(tabObj.newFile){
					    that._oFilesTree.fireToggleOpenState({
					        itemContext:tabObj.parentContext,
					        expanded:true
					    })
					    
					    tabObj.newFile = false
					}
					
					
					
				}).catch(error=>{console.log(error)}).finally(()=>{
				    
				    that._oFilesTabContainer.setBusy(false);
				})
				
			
			}else{
			    MessageBox.warning("No File Open")
			    
			}	
			
		},
		onRun: function () {
			var oTabContainerItem = sap.ui.getCore().byId(this._oFilesTabContainer.getSelectedItem());
			if(oTabContainerItem){
			   let path = oTabContainerItem.getKey().replace('/WEB', '')
			   var url = `${window.location.origin}/XMII/CM/${path}`
			   window.open(url, '_blank') 
			}else{
			    MessageBox.warning("No File Open")
			}
			
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
		     if(!that._oFilesTree.getSelectedItem()){
    		        MessageBox.warning("No File Selected")
    		        return
    		    } 
		    let context = this.getView().byId('filesTree').getSelectedItem().getBindingContext("Catalog")
			var path = context.getPath()
			var oNode = this._oCatalogModel.getProperty(path);
			if(!oNode.IsWebDir){
			    MessageBox.warning("Can not create file inside another file!")
			    return
			}
			
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
			    that.addFilesTabContainerItem(oNode.path + '/' + name, '',context,true)
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
		    if(!this.getView().byId('filesTree').getSelectedItem()){
		        MessageBox.warning("No File Selected")
		        return
		    }
		    let context = this.getView().byId('filesTree').getSelectedItem().getBindingContext("Catalog")
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
					url: `/XMII/Runner?Transaction=${QT.miiServicesTrx}&OutputParameter=*&Content-Type=text/xml`+
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
		    if(!that.getView().byId('filesTree').getSelectedItem()){
		        MessageBox.warning("No file Selected")
		        return
		    }
		    let context = that.getView().byId('filesTree').getSelectedItem().getBindingContext("Catalog")
		    
		    var oNode = context.getObject()
		    var sPath = context.getPath()
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
    					            that._removeTab(tab)
    					        }
    
    		            })
    		          } 
    		        }
    		    })
    		   
		},
		_deleteFile:function(filePath){
		    return new Promise((resolve,reject)=>{
		        $.ajax({
		            url:`/XMII/Runner?Transaction=${QT.miiServicesTrx}&OutputParameter=*&Content-Type=text/xml`+
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
		        MessageBox.error("Can't change the folder name")
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
		            
		            that._deleteFile(oldFilePath).then(res=>{
		                that._saveFile(oNode.path+'/'+name,content).then(res2=>{
    		                    that._oCatalogModel.setProperty(sPath+'/title', name)
                		        var tab = that.isFileOpen(oldFilePath)
                		        if(tab){
                		            that._removeTab(tab)
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
    	    
    	    var otree =  that.getView().byId('filesTree')
    	     if(!otree.getSelectedItem()){
    		        MessageBox.warning("No File Selected")
    		        return
    		  } 
    	    
    	    let sPath = otree.getSelectedContexts()[0].sPath
    	    let oNode = otree.getModel('Catalog').getProperty(sPath)
			
		    copiedFilePath = oNode.path+'/'+oNode.title
		    
            var result = this.copyToClipboard(copiedFilePath)
			
            if(result){
                 MessageToast.show('file path copied to clip board')
                 
            }else{
                 MessageToast.show('failed to copy file path to clip board')
            }
		},
		copyToClipboard:(text)=>{
                if (window.clipboardData && window.clipboardData.setData) {
                    // IE specific code path to prevent textarea being shown while dialog is visible.
                    return clipboardData.setData("Text", text); 
            
                } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
                    var textarea = document.createElement("textarea");
                    textarea.textContent = text;
                    textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                        return document.execCommand("copy");  // Security exception may be thrown by some browsers.
                    } catch (ex) {
                        console.warn("Copy to clipboard failed.", ex);
                        return false;
                    } finally {
                        document.body.removeChild(textarea);
                    }
                }
        },
		pasteFile: function (oEvent) {
		    if(copiedFilePath){
		        let oNode, context,sPath;
		        
		        context =  that.getView().byId('filesTree').getSelectedItem().getBindingContext('Catalog')
		        
		        oNode = context.getObject()
    		    sPath = context.getPath()
    		    
    		    let parentFolderPath = oNode.path
    		    
    		    if(!oNode.IsWebDir){
    			    MessageBox.warning("Can not paste file inside another file")
    			    return
    			}
    		    
    	        let fileName = copiedFilePath.split('/').slice(-1)[0]
    	        
    	        that._getFileData(copiedFilePath).then(content=>{
    	           
    	           that._saveFile(parentFolderPath+'/'+fileName,content).then(res=>{
    	               that.getView().byId("filesTree").fireToggleOpenState({
    	                   itemContext:context,
    	                   expanded:true
    	               })
    	               
    	               copiedFilePath = undefined
    	           })
    	         
    	        })
		    }else{
		        MessageBox.error("Copy a file beore pasting")
		    }
		       
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
						    resolve(data)
						}else{
						    reject(data)
						}
					},
					error: that.ajaxErrorHandler
				});  
		        
		        
		    })
		    
		},
		createView:{
		    
    		 context:'',
    		 onCreate: function (oEvent) {
    		    if(!that._oFilesTree.getSelectedItem()){
    		        MessageBox.warning("No File Selected")
    		        return
    		    } 
    		    this.context = that._oFilesTree.getSelectedItem().getBindingContext('Catalog')
    		    //oEvent.getSource().getBindingContext("Catalog")  
    		    let oNode = this.context.getObject()
    		    let parentFolderPath = oNode.path
    		    
    		     if(!oNode.IsWebDir){
			        MessageBox.warning("Can not create view file inside another file!")
			        return
			     }
    		    
    		    if(!this.pViewDialog){
    		               this.pViewDialog =  that.loadFragment({
    		                name:"miiCodeEditor.fragment.viewDialog"
    		            })
    		        
    		    }
    		    this.pViewDialog.then(oDialog=>{
    		         this.oDialog = oDialog
    		         oDialog.setModel(new JSONModel({
    		              viewName:'',
    		              controllerName:'',
    		              parentFolderPath:parentFolderPath
    		                   }))
    		           oDialog.open()
    		          })
    
    		 },
    		 validateViewName:function(oEvent){
    		     var sVal = oEvent.getSource().getValue()
    		     if(!sVal || sVal==='' || sVal.toLowerCase().match('.view.xml')){
    		         oEvent.getSource().setValueState('Error')
    		         
    		     }else{
    		          oEvent.getSource().setValueState('Success')
    		     }
    		 },
    		createFile:function(oEvent){
    		    
    		    let oDialog = this.oDialog
    		    //that.getView().byId("view-dialog")
    			let thisRef = this
    			let oData = oDialog.getModel().getData() 
                
                if(!oData.viewName || oData.viewName==='' || oData.vnState==='Error'){
                    MessageBox.error("Enter valid View Name")
                    return
                }
                oDialog.close()
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
    		    this.oDialog.close()
    		}
		},
		createController:{
		    parentFolderPath:'',
		    oModel: '',
		    context:'',
		    oDialog:'',
		    onCreate: function (oEvent) {
		         if(!that._oFilesTree.getSelectedItem()){
    		        MessageBox.warning("No File Selected")
    		        return
    		      } 
		         this.context = that._oFilesTree.getSelectedItem().getBindingContext('Catalog')
		         //oEvent.getSource().getBindingContext("Catalog")
                 let oNode = this.context.getObject()
                 
                 if(!oNode.IsWebDir){
			        MessageBox.warning("Can not create controller file inside another file!")
			        return
			     }
			     
                 this.oModel = new JSONModel({
        		              controllerName:'',
        		              cnState:'None',
        		              controllerPath:'',
        		              cpState:'None',
        		              modules: modules
        		            })
        		                   
                 let oModel = this.oModel
    		     this.parentFolderPath = oNode.path
    		    
        		    if(!this.pDialog){
        		               this.pDialog =  that.loadFragment({
        		               name:"miiCodeEditor.fragment.controllerDialog"
        		            })
        		        
        		    }
        		    this.pDialog.then(oDialog=>{
        		        this.oDialog = oDialog
        		         oDialog.setModel(oModel)
        		         oDialog.open()
        		   })
        
    		},
    		validateConName:function(oEvent){
    		    let sVal = oEvent.getSource().getValue()
    		    if(sVal=='' || sVal.toLowerCase().match('.controller.js')){
    		        oEvent.getSource().setValueState('Error')
    		        
    		    }else{
    		        oEvent.getSource().setValueState('Success')
    		    }
    		},
    		validateConPath:function(oEvent){
    		    let sVal = oEvent.getSource().getValue()
    		    if(sVal=='' || sVal.match(this.oModel.getData().controllerName)){
    		        oEvent.getSource().setValueState('Error')
    		    }else{
    		        oEvent.getSource().setValueState('Success')
    		    }
    		},
		    createFile:function(){
		       let parentFolderPath =  this.parentFolderPath 
			   let sModules = ""
		       let sModuleRef = ""
		   	   let oData = this.oModel.getData()
		   	   let thisRef = this;
		   	   let oComboBox = that.getView().byId('id-selected-modules')
		   	   let selectedModules = oComboBox.getSelectedItems()
		   	   
		   	   //Validations
		   	   if(oData.controllerName==='' || oData.controllerPath===''|| oData.cnState =='Error' || oData.cpState=='Error'){
		   	       MessageBox.error("Please enter all required fileds")
		   	       return;
		   	   }
		   	   
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
    		           sContent = sContent.replaceAll("#Controller-ref#",oData.controllerPath+'.'+oData.controllerName)
    		           
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
    		    if(!that._oFilesTree.getSelectedItem()){
    		        MessageBox.warning("No File Selected")
    		        return
    		    } 
    		    this.context = that._oFilesTree.getSelectedItem().getBindingContext('Catalog') 
    		    //oEvent.getSource().getBindingContext("Catalog")  
    		    let oNode = this.context.getObject()
    		     if(!oNode.IsWebDir){
			        MessageBox.warning("Can not create Fragment file inside another file!")
			        return
			     }
    		    
    		    this.parentFolderPath = oNode.path
    		    
    		    if(!this.pFragDialog){
    		               this.pFragDialog =  that.loadFragment({
    		                name:"miiCodeEditor.fragment.fragmentDialog"
    		            })
    		        
    		    }
    		    this.pFragDialog.then(oDialog=>{
    		        this.oDialog = oDialog
    		         oDialog.setModel(new JSONModel({
    		              fragmentName:'',
    		              valueState:'None'
    		           }))
    		           oDialog.open()
    		          })
    
    		 },
    		 validateFragName:function(oEvent){
    		     var sVal = oEvent.getSource().getValue()
    		     if(!sVal || sVal=='' || sVal.toLowerCase().match('.fragment.xml')){
    		         oEvent.getSource().setValueState('Error')
    		     }else{
    		          oEvent.getSource().setValueState('Success')
    		     }
    		 },
    		createFile:function(oEvent){
    		    let oDialog =  this.oDialog
    		    //that.getView().byId("fragment-dialog")
				
    			let thisRef = this
    			let oData = oDialog.getModel().getData() 
    			if(!oData.fragmentName || oData.fragmentName=='' || oData.valueState=='Error'){
    			    MessageBox.error("Please Enter valid fragment name")
    			    return
    			}
    
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
    		    this.oDialog.close()
    		}

		},
		createFioriApp:{
          onCreate:function(oEvent){
               if(!that._oFilesTree.getSelectedItem()){
    		        MessageBox.warning("No File Selected")
    		        return
    		    } 
                this.context = that._oFilesTree.getSelectedItem().getBindingContext('Catalog')
                //oEvent.getSource().getBindingContext("Catalog")  
    		    let oNode = this.context.getObject()
    		    this.parentFolderPath = oNode.path
    		    
    		     if(!oNode.IsWebDir){
			        MessageBox.warning("Can not create Ui5 App inside another file!")
			        return
			     }
    		    
                let thisRef = this
    		    if(!this.pAppDialog){
    		               this.pAppDialog =  that.loadFragment({
    		                name:"miiCodeEditor.fragment.fioriApp"
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
             
            //validating
			  let validationFlag= true;
			  let aContent = this.oDialog.getContent()[0].getContent()
			  
			  for(let i=1; i<aContent.length; i+=2 ){
				  
				  if(aContent[i].getValueState()==='Error'){
					  validationFlag = false
					  break;
				  }
			  }
			  

			  if(validationFlag===false){
				  MessageBox.error('Please enter all required fields')
				  return
			  }
              
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
                         
                         content =  content.replaceAll("#app-ref#",data.appRef).replaceAll("#viewName#",data.viewName)
                                       
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
                
                let versionDetails = new Promise((resolve,reject)=>{
                    $.ajax({
                        url:`/XMII/Illuminator?QueryTemplate=${QT.getLatestVersion}`,
                        data:{
                            'Param.1':  oTab.getKey(),
                            'Content-Type':'text/json'
                        },
                        success: oData=>resolve(oData),
                        error:e=> reject(e)
                        
                    })
                })
                
                versionDetails.then(versionData=>{
                   
                    let version = 1;
                     if(versionData && versionData.Rowsets.Rowset[0].Row){
                         version = versionData.Rowsets.Rowset[0].Row[0].version+1
                     }
                    
                    thisRef.commitModel = new JSONModel({
                       filePath:oTab.getKey(),
                       version: version,
                       message:''
                    })
                    if(!thisRef.pCommitDialog){
                        thisRef.pCommitDialog = that.loadFragment({
                            name:"miiCodeEditor.fragment.commitFragment"
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
                
                 let modelData = this.commitModel.getData() 
                 let thisRef = this;
				 thisRef.commitDialog.setBusy(true)
				 //thisRef.tab.setBusy(true)
                 
                 $.ajax({
                     url:`/XMII/Illuminator?QueryTemplate=${QT.insertIntoVersionMDOQry} `,
                     method:'post',
                     data:{
                         'Param.1': modelData.filePath,
                         'Param.2':modelData.message,
                         'Param.3': that.b64EncodeUnicode(thisRef.content),
                         'Param.4': modelData.version,
						 'Content-Type':'text/json'
                     },
                     success:oRes=>{
						 if(!that.fatalErrorHandler(oRes)){
							 thisRef.commitDialog.close()
							 MessageToast.show('Changes Commited')
						 }
					 }
                 }).always(()=>{
					 thisRef.commitDialog.setBusy(false)
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
                thisRef.filePath = oTab.getKey()
                
                $.ajax({
                    url:`/XMII/Illuminator?QueryTemplate=${QT.getVersionDetails}`,
                    data:{
                        'Param.1':oTab.getKey(),
                        'Content-Type':'text/json'
                    },
                    success:oVersionData=>{
                        if(!that.fatalErrorHandler(oVersionData)){
                            thisRef.versionModel = new JSONModel(oVersionData)
                            if(!thisRef.pVerDialog){
                                thisRef.pVerDialog = that.loadFragment({
                                    name:"miiCodeEditor.fragment.versions"
                                })
                            }
                            
                            thisRef.pVerDialog.then(oDialog=>{
                                oDialog.setModel(thisRef.versionModel)
                                oDialog.open()
                                thisRef.Dialog = oDialog
                            })  
                        }
                    }
                })
		    
		},
		 closeDialog:function(){
		    this.Dialog.close() 
	    },
	    viewCode:function(oEvent){
	        let dataObj = oEvent.getSource().getBindingContext().getObject()
	        
	        $.ajax({
	            url:`/XMII/Illuminator?QueryTemplate=${QT.getCode}`,
	            data:{
	                'Param.1':dataObj.FilePath,
	                'Param.2':dataObj.version,
	                'Content-Type':'text/json'
	               },
	           success: oData=>{
	               if(!that.fatalErrorHandler(oData)){
	                    
            			this.Dialog.close()
            		    var aName = dataObj.FilePath.split('/').slice(-1).join('').split('.')
            			var sName = aName.slice(0,-1).join('.')+'_v'+dataObj.version+'.'+aName.slice(-1)
            			var sKey = dataObj.FilePath+dataObj.version
            			var sCode = that.b64DecodeUnicode(oData.Rowsets.Rowset[0].Row[0].Code)
            			
            			that._splitTab(sKey,sName,sCode)
            			
	               }
	           }
	        })
			
			
	    }
	
	},
	_setSplitterWidth:function(aWidths){
	    let splitter =  this.getView().byId("contentSplitter")
		splitter.getContentAreas().forEach((item,i)=>{
			item.getAggregation('layoutData').setSize(aWidths[i])
		})
	    
	},
	toggleFullScreen:(oEvent)=>{
	    
	    var elem = document.documentElement;
	    var  state = oEvent.getSource().data("state")
        
        
        if(state==='normal'){
            openFullscreen()
            oEvent.getSource().data("state",'fullscreen') 
            oEvent.getSource().setIcon('sap-icon://exit-full-screen')
        }else{
            closeFullscreen()
            oEvent.getSource().data("state",'normal')
            oEvent.getSource().setIcon('sap-icon://full-screen')
        }
        /* View in fullscreen */
        function openFullscreen() {
          if (elem.requestFullscreen) {
            elem.requestFullscreen();
          } else if (elem.webkitRequestFullscreen) { /* Safari */
            elem.webkitRequestFullscreen();
          } else if (elem.msRequestFullscreen) { /* IE11 */
            elem.msRequestFullscreen();
          }
        }
        
        /* Close fullscreen */
        function closeFullscreen() {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
          } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
          }
        }
	},
	openAPIReference:function(oEvent){
	    window.open('https://sapui5.hana.ondemand.com/?sap-ui-theme=sap_fiori_3_dark#/api','_blank')
	},
	splitTab:function(){
	   if( this._oFilesTabContainer.getItems().length === 0){
	       MessageBox.warning("No files Open!")
	       return;
	   }
	        
	    var oSelectedItem = sap.ui.getCore().byId(this._oFilesTabContainer.getSelectedItem())
	    this._splitTab(oSelectedItem.getKey(),oSelectedItem.getName(),oSelectedItem.getContent()[0].getCurrentValue(),oSelectedItem)
    
	},
	_splitTab:function(key,name,code,oSelectedItem=undefined){
	   var oTabContainerItem; 
	   let fileExt = name.split('.').slice(-1).join('')
	   if(!this.codeViewerTabContainer){
	         this.codeViewerTabContainer = new sap.m.TabContainer({
	             itemClose:function(oEvent){
	                if(that.codeViewerTabContainer.getItems().length ===1){
	                     that.getView().byId('contentSplitter')
	                        .removeContentArea(that.codeViewerTabContainer)
	                    that._resetSplitterWidths()
	                 }
	             }
	         })
	        
	   }
	   this.codeViewerTabContainer.setModel(oFilesTabContainerModel)
	   this.getView().byId('contentSplitter').addContentArea(this.codeViewerTabContainer)
	    
	    for(let item of this.codeViewerTabContainer.getItems()){
	         if(item.getKey()=== key){
	            this.codeViewerTabContainer.setSelectedItem(item)
	            return;
	        }
	    }
	    
	    if(oSelectedItem){
	        let sPath = oSelectedItem.getBindingContext().sPath
	        
	        oTabContainerItem = new TabContainerItem({
                key:`{${sPath}/key}`,
		    	name: `{${sPath}/name}`
		    });
		 
		    oTabContainerItem.addContent(new CodeEditor({
		        type: `{${sPath}/type}`,
		        colorTheme:`{${sPath}/colorTheme}`,
		        value:`{${sPath}/code}`
		     
		    }).addStyleClass('zcodeEditor'))
		 
	     }else{
	         
	         oTabContainerItem = new TabContainerItem({
                key:key,
		    	name: name
		    });
		    
	         oTabContainerItem.addContent(new CodeEditor({type:  that.getEditorType(fileExt),colorTheme:"tomorrow_night"})
			.setValue(code)
			.addStyleClass('zcodeEditor'))
	         
	         
	     }
          
			
		this.codeViewerTabContainer.addItem(oTabContainerItem)	
		this.codeViewerTabContainer.setSelectedItem(oTabContainerItem)
        this._resetSplitterWidths()
	    
	},
	showAPIReference:function(){
	    if(!this.ApiRefTab){
	        that.loadFragment({
    	        name:"miiCodeEditor.fragment.ApiReference"
	        }).then(ApiRefTab=>{
		        this.ApiRefTab = ApiRefTab
		        this.getView().byId('contentSplitter').addContentArea(this.ApiRefTab)
	            this._resetSplitterWidths()
	        }) 
	     }else{
			     
		    this.getView().byId('contentSplitter').addContentArea(this.ApiRefTab)
	        this._resetSplitterWidths()
		 }
	     
	},
	_resetSplitterWidths:function(){
	     var numberOfTabs = that.getView().byId('contentSplitter').getContentAreas().length
	     var widths = []
	     switch(numberOfTabs){
	       case 2: widths = ['0%','100%']; break
	       case 3: widths = ['0%','50%','50%']; break;
	       case 4: widths = ['0%','50%','25%','25%']; break;
	     }
	     
	     that._setSplitterWidth(widths)
	     
	     
	},
	closeApiRef:function(){
	    if(this.ApiRefTab){
	        this.getView().byId('contentSplitter').removeContentArea(this.ApiRefTab)
            this._resetSplitterWidths()	        
	    }
	},
	openCreateMenu:function(oEvent){
	    var oBtn = oEvent.getSource()
	   this.byId("createMenuFragment").openBy(oBtn);
	}
	
	
})

});



