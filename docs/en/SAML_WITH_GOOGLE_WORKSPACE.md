# Google Workspace and SAML Integration

This guide introduces reference procedures for integrating Google Workspace with SAML. Please modify the detailed parameters to match your environment.

# Preliminary Work

First, deploy GenU. After the initial deployment, set up SAML integration between Cognito and Google Workspace.

Open the Outputs tab in the CloudFormation Stack screen and note the WebUrl.

![image-20240205185011526](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240205185011526.png)

Next, from the Resource tab, note the Physical ID of the Cognito user pool.

![image-20240128114108630](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317105731051.png)

# Cognito Configuration: Domain Settings

Proceed with the Cognito domain configuration.
In the Cognito user pool screen, open the App integration tab and display the Domain screen. Since the Cognito Domain is blank, select Create Cognito domain from Actions.

![image-20240128115029927](../assets/SAML_WITH_ENTRA_ID/image-20240128115029927.png)

Give it an appropriate name and press Create Cognito domain. In this procedure, we'll use `your-preferred-name-google`. You need to provide a globally unique name.

![image-20240128115448597](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316234530866.png)

The Cognito domain has been configured.

![image-20240128115539920](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316234607065-1710645672447-1710645678992.png)

# Google Workspace Configuration: SAML Application

Open the Google Workspace admin console from the URL below and proceed with the SAML configuration.
https://admin.google.com/u/0/ac/home

From the application settings screen, click on Add Custom SAML App.

![image-20240316233910260](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316233910260.png)

Enter an administrative name for Google Workspace. Any name will do. Here we'll use `generative-ai-use-cases`.

![image-20240316234731919](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316234731919.png)

Click the Download metadata button to download `GoogleIDPMetadata.xml`, then press Continue.

![image-20240316234937484](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316234937484.png)

Specify the following parameters. Use the User Pool ID confirmed in "Preliminary Work" and the domain name set in "Cognito Configuration: Domain Settings".

ACS URL

```
# Format
https://<entered value>.auth.yourRegion.amazoncognito.com/saml2/idpresponse

# Example
https://your-preferred-name-google.auth.ap-northeast-1.amazoncognito.com/saml2/idpresponse
```

Entity ID

```
# Format
urn:amazon:cognito:sp:<UserPoolID>

# Example
urn:amazon:cognito:sp:ap-northeast-1_Rxt6J1TtI
```

Here's an example of what was entered. After entering, press Continue.

![image-20240316235220492](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316235220492.png)

For attributes, configure how Google Directory attributes will integrate with Cognito. Specify `email` for `Primary email`. Then press Finish.

![image-20240316235522443](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316235522443.png)

The application has been configured.

![image-20240316235732511](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316235732511.png)

# Google Workspace: Access Permission Settings

Open the details screen of the created application to configure access permissions. From the details screen, click on the "Off (all users)" section.

![image-20240317000224510](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317000224510.png)

In this sample procedure, we'll grant access to users belonging to the "Company-wide" organization. Select "On" for the entire company and press Override.  
These access permission settings can be configured in detail according to your environment, so please modify them based on your organization's policies.

![image-20240317000758589](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317000758589.png)

It has changed to On.

![image-20240317000846899](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317000846899.png)

# Cognito Configuration: Federation

Return to the Cognito configuration in the AWS Management Console.
Open the Cognito User Pool screen, go to the Sign-in experience tab, and select Add identity provider.

![image-20240128124451746](../assets/SAML_WITH_ENTRA_ID/image-20240128124451746.png)

Select SAML for Google Workspace integration. **Select SAML, not Google.**

![image-20240128124529523](../assets/SAML_WITH_ENTRA_ID/image-20240128124529523.png)

Enter an easily identifiable name in the Provider name field. The Provider name specified here will be used in cdk.json in later steps.
Choose file and upload the "GoogleIDPMetadata.xml" downloaded from Google Workspace.

![image-20240317001734180](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317001734180.png)

Specify email for User pool attribute.
Enter `email` for SAML attribute and select Add identity provider.

![image-20240317001748561](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317001748561.png)

The configuration has been added.

![image-20240317001814305](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317001814305.png)

# Cognito Configuration: Hosted UI

Configure the Hosted UI for Google Workspace integration. Select the App Integration tab.

![image-20240128125211108](../assets/SAML_WITH_ENTRA_ID/image-20240128125211108.png)

Select the existing App Client.

![image-20240128125243769](../assets/SAML_WITH_ENTRA_ID/image-20240128125243769.png)

Press Edit.

![image-20240128125314475](../assets/SAML_WITH_ENTRA_ID/image-20240128125314475.png)

Enter the WebUrl value confirmed in [Preliminary Work](#preliminary-work) in both Allowed callback URLs and Allowed sign-out URLs.
If you want to use a [local development environment](./DEVELOPMENT.md) for frontend development, also add `http://localhost:5173` to both Allowed callback URLs and Allowed sign-out URLs.

![image-20240205185602299](../assets/SAML_WITH_ENTRA_ID/image-20240205185602299.png)

Select `GoogleWorkspace` for Identity Provider. Also, uncheck the Cognito user pool checkbox as we want to disable authentication using the Cognito user pool.

![image-20240317002017655](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317002017655.png)

Press Save changes.

![image-20240128132707060](../assets/SAML_WITH_ENTRA_ID/image-20240128132707060.png)

It has been added.

![image-20240317125402303](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317125402303.png)

# Editing cdk.json

Now that the configuration is complete, modify the values in cdk.json.

- samlAuthEnabled: Specify `true`. This switches to a SAML-specific authentication screen, and the conventional authentication function using Cognito user pools will no longer be available.
- samlCognitoDomainName: Enter the Cognito Domain name specified in "Cognito Configuration: Domain Settings".
- samlCognitoFederatedIdentityProviderName: Enter the Identity Provider name configured in "Cognito Configuration: Federation".

```json
  "context": {
     <omitted>
    "samlAuthEnabled": true,
    "samlCognitoDomainName": "your-preferred-name-google.auth.ap-northeast-1.amazoncognito.com",
    "samlCognitoFederatedIdentityProviderName": "GoogleWorkspace",
```

After configuration, redeploy to enable SAML integration.
