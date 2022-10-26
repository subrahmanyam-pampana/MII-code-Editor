sap.ui.define([
	"sap/ui/core/UIComponent",
    "sap/m/MessageBox"
], function (UIComponent,MessageBox) {
	"use strict";
	let userName,roles;

	return UIComponent.extend("miiCodeEditor.Component", {

		metadata : {
			interfaces: ["sap.ui.core.IAsyncContentCreation"],
			manifest: "json"
		},

		init : function () {
		
			userName = $('#CD_USER').val()
			roles = $('#CD_USER_ROLES').val()
			roles = roles.replaceAll("'",'').split(',')
			console.log(userName,roles)
			if(!this.isAuthorized()){
			    MessageBox.warning("your not authorized to view the code")
			    return
			}else{
			    UIComponent.prototype.init.apply(this, arguments);
			}
		
		},
		isAuthorized:function(){
		    
		    let authorisedUsers = new Set([
                "SAP_XMII_Administrator",
                "SAP_XMII_Developer",
                "SAP_XMII_Super_Administrator"])
            let authorizedFlag = false    
                
            roles.forEach(role=>{
                if(authorisedUsers.has(role)){
                    authorizedFlag = true
                    return
                }
            })
            
            return authorizedFlag
		}
	});

});