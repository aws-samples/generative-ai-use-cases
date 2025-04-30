# Microsoft Entra ID and SAML Integration

This guide introduces the reference procedure for integrating Microsoft Entra ID (formerly Azure Active Directory) with SAML. Please modify the detailed parameters to match your environment.

# Preliminary Work

First, deploy GenU. After the initial deployment, you will set up SAML integration between Cognito and Entra ID.

Open the Outputs tab on the CloudFormation Stack screen and note the WebUrl.

![image-20240205185011526](../assets/SAML_WITH_ENTRA_ID/image-20240205185011526.png)

Next, from the Resource tab, note the Physical ID of the Cognito user pool.

![image-20240128114108630](../assets/SAML_WITH_ENTRA_ID/image-20240128114108630.png)

# Cognito Configuration: Domain Setup

Proceed with the Cognito domain configuration.
On the Cognito user pool screen, open the App integration tab and display the Domain screen. Since the Cognito Domain is blank, select Create Cognito domain from Actions.

![image-20240128115029927](../assets/SAML_WITH_ENTRA_ID/image-20240128115029927.png)

Assign an appropriate name and press Create Cognito domain. In this procedure, we will use `your-preferred-name`. You need to use a globally unique name.

![image-20240128115448597](../assets/SAML_WITH_ENTRA_ID/image-20240128115448597.png)

The Cognito domain has been configured.

![image-20240128115539920](../assets/SAML_WITH_ENTRA_ID/image-20240128115539920-1707114112930.png)

# Microsoft Entra ID Configuration

Enable SAML integration in Microsoft Entra ID (formerly Azure Active Directory).

Open the Microsoft Entra ID configuration screen from Microsoft Azure.

![image-20240128121313366](../assets/SAML_WITH_ENTRA_ID/image-20240128121313366.png)

Select Enterprise Applications.

![image-20240128121505749](../assets/SAML_WITH_ENTRA_ID/image-20240128121505749.png)

Select New application.

![image-20240128121555503](../assets/SAML_WITH_ENTRA_ID/image-20240128121555503.png)

Select Create your own application.

![image-20240128121629558](../assets/SAML_WITH_ENTRA_ID/image-20240128121629558-1707115633384.png)

Enter any application name and press Create. In this example, we are using `generative-ai-use-cases`.

![image-20240128121916888](../assets/SAML_WITH_ENTRA_ID/image-20240128121916888.png)

From the Single sign-on menu, select SAML.

![image-20240128122006365](../assets/SAML_WITH_ENTRA_ID/image-20240128122006365.png)

Press Edit in Basic SAML Configuration.

![image-20240128122115335](../assets/SAML_WITH_ENTRA_ID/image-20240128122115335.png)

Enter the following parameters and press save. Use the Cognito user pool ID confirmed in [Preliminary Work](#preliminary-work) and the Domain value confirmed in [Cognito Configuration: Domain Setup](#cognito-configuration-domain-setup).

Identifier (Entity ID)

```
# Format
urn:amazon:cognito:sp:<UserPoolID>

# Example
urn:amazon:cognito:sp:ap-northeast-1_p0oD4M3F0
```

Reply URL (Assertion Consumer Service URL)

```
# Format
https://<your-entered-value>.auth.yourRegion.amazoncognito.com/saml2/idpresponse

# Example
https://your-preferred-name.auth.ap-northeast-1.amazoncognito.com/saml2/idpresponse
```

Specify the values and press Save.

![image-20240128122339147](../assets/SAML_WITH_ENTRA_ID/image-20240128122339147.png)

The settings have been applied.

![image-20240128122454341](../assets/SAML_WITH_ENTRA_ID/image-20240128122454341.png)

Select Download under Federation Metadata XML to obtain the XML file.

![image-20240128122534056](../assets/SAML_WITH_ENTRA_ID/image-20240128122534056.png)

Add users or groups to be associated with this application. Only users and groups linked here will be able to log in.

![image-20240128122707248](../assets/SAML_WITH_ENTRA_ID/image-20240128122707248.png)

In this example, we specify a user that was created in advance. Please specify according to your environment.

![image-20240128122807048](../assets/SAML_WITH_ENTRA_ID/image-20240128122807048.png)

Press Assign.

![image-20240128122832158](../assets/SAML_WITH_ENTRA_ID/image-20240128122832158.png)

# Cognito Configuration: Federation

Return to the Cognito configuration in the AWS Management Console.
Open the Cognito User Pool screen, and from the Sign-in experience tab, select Add identity provider.

![image-20240128124451746](../assets/SAML_WITH_ENTRA_ID/image-20240128124451746.png)

Select SAML as we are using SAML for integration with Entra ID.

![image-20240128124529523](../assets/SAML_WITH_ENTRA_ID/image-20240128124529523.png)

Enter an easily identifiable name in the Provider name field. The Provider name specified here will be included in cdk.json in a later step.
Select Choose file and upload the "Federation Metadata XML" downloaded from Entra ID.

![image-20240128124624371](../assets/SAML_WITH_ENTRA_ID/image-20240128124624371.png)

Specify email for User pool attribute.
For SAML attribute, select the following string and then select Add identity provider.

```
http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
```

![image-20240128124827012](../assets/SAML_WITH_ENTRA_ID/image-20240128124827012.png)

The configuration has been added.

![image-20240128125053814](../assets/SAML_WITH_ENTRA_ID/image-20240128125053814.png)

# Cognito Configuration: Hosted UI

Now we'll configure the Hosted UI to use the Entra ID integration. Select the App Integration tab.

![image-20240128125211108](../assets/SAML_WITH_ENTRA_ID/image-20240128125211108.png)

Specify the existing App Client.

![image-20240128125243769](../assets/SAML_WITH_ENTRA_ID/image-20240128125243769.png)

Press Edit.

![image-20240128125314475](../assets/SAML_WITH_ENTRA_ID/image-20240128125314475.png)

Enter the WebUrl value confirmed in [Preliminary Work](#preliminary-work) into both Allowed callback URLs and Allowed sign-out URLs.
If you want to use a [local development environment](./DEVELOPMENT.md) for frontend development, also add `http://localhost:5173` to both Allowed callback URLs and Allowed sign-out URLs.

![image-20240205185602299](../assets/SAML_WITH_ENTRA_ID/image-20240205185602299.png)

Select EntraID for Identity Provider. Also, since we want to stop authentication using the Cognito user pool, uncheck the Cognito user pool checkbox.

![image-20240207123836497](../assets/SAML_WITH_ENTRA_ID/image-20240207123836497.png)

Press Save changes.

![image-20240128132707060](../assets/SAML_WITH_ENTRA_ID/image-20240128132707060.png)

The configuration has been added.

![image-20240128132652553](../assets/SAML_WITH_ENTRA_ID/image-20240128132652553.png)

# Editing cdk.json

Now that the configuration is complete, modify the values in cdk.json.

- samlAuthEnabled: Specify `true`. This switches to a SAML-specific authentication screen, and the conventional authentication function using Cognito user pools will no longer be available.
- samlCognitoDomainName: Enter the Cognito Domain name specified in ["Cognito Configuration: Domain Setup"](#cognito-configuration-domain-setup).
- samlCognitoFederatedIdentityProviderName: Enter the Identity Provider name configured in ["Cognito Configuration: Federation"](#cognito-configuration-federation).

```json
  "context": {
　　 <omitted>
    "samlAuthEnabled": true,
    "samlCognitoDomainName": "your-preferred-name.auth.ap-northeast-1.amazoncognito.com",
    "samlCognitoFederatedIdentityProviderName": "EntraID",
```

After configuration, deploy again to enable SAML integration.

---

# (Optional) SAML IdP Group Custom Attribute Configuration

This section introduces how to map Roles or Groups managed in SAML IdP to Cognito Attributes for RAG filtering.

First, in the Entra ID Enterprise Application screen, select Edit in Attributes & Claims to edit.

![image-20250109000000001](../assets/SAML_WITH_ENTRA_ID/image-20250109000000001.png)

Add a Group Claim from Add a group claim. Select the scope of groups to share with the application according to your requirements. (Details can be found [here](https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/how-to-connect-fed-group-claims))

![image-20250109000000002](../assets/SAML_WITH_ENTRA_ID/image-20250109000000002.png)

Next, on the Cognito User Pool screen, open the Custom attributes addition screen from Sign-up.

![image-20250109000000003](../assets/SAML_WITH_ENTRA_ID/image-20250109000000003.png)

Create a Custom Attribute with an appropriate name. In this example, we are using `idpGroup`.

![image-20250109000000004](../assets/SAML_WITH_ENTRA_ID/image-20250109000000004.png)

Next, open the Attribute mapping screen in the Social Identity Provider screen.

![image-20250109000000005](../assets/SAML_WITH_ENTRA_ID/image-20250109000000005.png)

Map the Custom Attribute name created earlier with the Entra ID Group Claim `http://schemas.microsoft.com/ws/2008/06/identity/claims/groups`.

![image-20250109000000006](../assets/SAML_WITH_ENTRA_ID/image-20250109000000006.png)

This completes the mapping of Groups defined in Entra ID to Cognito Attributes.

Since Custom Attributes are included in the ID token, they can now be used by the application.

To use it for Knowledge Base RAG filtering, uncomment `Example2` in the `getDynamicFilters` function in `packages/common/src/custom/rag-knowledge-base.ts`.

```typescript
// Example 2: Filter by SAML IdP group custom attribute (Check steps to setup attribute mapping in docs/SAML_WITH_ENTRA_ID.md)

const groups = (idTokenPayload['custom:idpGroup'] as string) // storing group as string (i.e. [group1id, group2id])
  .slice(1, -1) // remove the first and last brackets
  .split(/, ?/) // split by comma and optional space
  .filter(Boolean); // remove empty strings
if (!groups) throw new Error('custom:idpGroup is not set'); // Error if Group is not set, preventing access
const groupFilter: RetrievalFilter = {
  in: {
    key: 'group',
    value: groups,
  },
};
dynamicFilters.push(groupFilter);
```

Filtering will be applied when the document's group metadata specifies the Object ID of the user's IdP group.

Similarly, other metadata can also be utilized using Cognito Custom Attributes and Attribute Mapping.
