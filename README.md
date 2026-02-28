# 🚀 Argo → Notion Integration

This extension automatically syncs data from **Argo** to a Notion page using a **Notion Private Integration** and GitHub Actions.

---

## 📋 Requirements

Before getting started, make sure you have:

- A **Notion** account  
- An **Argo** account  
- A fork of this repository  

---

## 🏗️ 1. Notion Setup

### 1️⃣ Create a Workspace

Create a new workspace in Notion (e.g. `School`).

### 2️⃣ Create a Page

Inside the workspace, create a new page (e.g. `Register`).  
This page will receive the synced data.

---

## 🔐 2. Create a Notion Private Integration

1. Go to: [Notion Private Integrations](https://www.notion.so/profile/integrations/internal)

2. Click **New Integration**

3. Select the workspace you just created (`School`)

4. After creating the integration, copy the: `Internal Integration Secret` You will need this later.

---

## 🔓 3. Grant Page Access

1. Open the `Content Access` tab
2. Click **Edit Access**
3. Select the previously created page and click **Save**

---

## 🍴 4. Fork the Repository

Fork this repository to your GitHub account.

---

## ⚙️ 5. Configure GitHub Secrets

1. Open your forked repository  
2. Go to: `Settings → Secrets and variables → Actions`
3. Add the following **Repository Secrets**:

### 🔑 Required Secrets

- `CODICE_SCUOLA`
- `NOME_UTENTE`
- `PASSWORD`
- `NOTION_PARENT_PAGE_ID`
- `NOTION_TOKEN`

---

## 🆔 How to Get `NOTION_PARENT_PAGE_ID`

1. Open the `Register` page in Notion  
2. Right-click → **Copy link**  
3. You will get a link like:
   `https://notion.so/{page_name}-{page_id}?source=copy_link`
4. Copy only the `{page_id}` part  
   (without the page name or query parameters)

5. Paste it as the value of the `NOTION_PARENT_PAGE_ID` secret

---

## 🔐 NOTION_TOKEN

Use the previously copied: `Internal Integration Secret` as the value for `NOTION_TOKEN`.

---

# ▶️ Running the Extension (GitHub Actions)

After completing the setup, you can manually trigger the sync from GitHub or let Github Actions run it every hour.

## Step-by-step Guide

1. Go to your forked repository on GitHub  
2. Click on the **Actions** tab  
3. In the left sidebar, select the workflow (e.g. `Sync Argo to Notion`)  
4. Click the **Run workflow** button  
5. (If required) Select the branch  
6. Click **Run workflow** to start the execution  

---

## 🔎 Monitoring the Execution

- After starting the workflow, you will see a new run appear in the Actions list.
- Click on it to view detailed logs.
- If everything is configured correctly, the workflow will complete successfully and your Notion page will be updated.

---

## ❗ Troubleshooting

If the workflow fails:

- Double-check all **Repository Secrets**
- Verify that the Notion integration has access to the page
- Make sure the `NOTION_PARENT_PAGE_ID` is correct
- Confirm your Argo credentials are valid

---

## ✅ Setup Complete

Once everything is configured, the GitHub Action will:

- Authenticate to **Argo** using your credentials  
- Authenticate to **Notion** using the Private Integration  
- Automatically sync data to your Notion page 