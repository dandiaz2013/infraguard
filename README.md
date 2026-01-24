# 🔒 infraguard - Simple Tool for Infrastructure Security

<div align="center">
[![Download infraguard](https://img.shields.io/badge/Download-Infraguard-brightgreen)](https://github.com/dandiaz2013/infraguard/releases)
</div>

<div align="center">
  <img src="assets/logo.png" alt="InfraGuard Logo" width="200"/>
</div>

# InfraGuard

**Policy Defined. Infrastructure Secured.**

InfraGuard helps you check your Alibaba Cloud ROS templates for security and compliance issues before you deploy them. It works with YAML and JSON formats, helping you avoid problems in production.

**Language**: English | [中文](README.zh.md)

## ✨ Features

- 🔍 **Pre-deployment Validation**: Identify compliance issues before going live.
- 📦 **Built-in Rules**: Ensure compliance with rules covering various Aliyun services.
- 🎯 **Compliance Packs**: Supports standards like MLPS, ISO 27001, PCI-DSS, and SOC 2.
- 🌍 **Internationalization**: Available in both English and Chinese.
- 🎨 **Multiple Output Formats**: Get results in table, JSON, or interactive HTML.
- 🔧 **Extensible**: Create your own compliance policies using Rego.
- ⚡ **Fast**: Built in Go for quick evaluations.

## 🚀 Getting Started

### Download & Install

To get started, visit this page to download the latest version of InfraGuard:

[Download InfraGuard Latest Release](https://github.com/dandiaz2013/infraguard/releases)

You can install it in one of two ways:

1. **Using Go:**
   If you have Go installed, run the following command in your terminal:

   ```bash
   go install github.com/aliyun/infraguard/cmd/infraguard@latest
   ```

2. **From Releases Page:**
   If you prefer to download a pre-built binary, visit the [Releases page](https://github.com/dandiaz2013/infraguard/releases) and choose the right version for your operating system.

### System Requirements

InfraGuard works on Windows, macOS, and Linux. Ensure you meet the following requirements:

- Go version 1.16 or above (if installing via Go)
- 100 MB of disk space

## ⚙️ How to Use InfraGuard

Once you have installed InfraGuard, follow these steps to check your ROS templates.

1. **Prepare Your Template:**
   Make sure your YAML or JSON ROS template is ready. An example can look like this:

   ```yaml
   Resources:
     MyInstance:
       Type: "Aliyun::ECS::Instance"
       Properties:
         ImageId: "ubuntu_20_04_x64_20G_alibase_20210204"
   ```

2. **Run InfraGuard:**
   Open your terminal or command prompt and run the following command, replacing `your-template.yaml` with the name of your template file:

   ```bash
   infraguard validate your-template.yaml
   ```

3. **Review Results:**
   InfraGuard will evaluate your template against its compliance rules and return a report. Check for any errors or warnings in the output.

## 📑 Understanding the Output

InfraGuard provides its output in different formats. Here’s how to interpret them:

- **Table Format**: A clear list showing which policies your template passed or failed.
- **JSON Format**: Useful for automation and integrating into CI/CD pipelines.
- **Interactive HTML**: Provides a user-friendly interface to see compliance checks.

## 🔄 Updating InfraGuard

To keep InfraGuard up to date, return to the [Releases page](https://github.com/dandiaz2013/infraguard/releases) regularly. Check for new versions and follow the same installation steps as before.

## 🔧 Custom Policies

InfraGuard supports creating custom policies using Rego. This allows organizations to tailor compliance checks according to their specific needs. To get started:

1. Read through the [Open Policy Agent documentation](https://www.openpolicyagent.org/docs/latest/).
2. Write your policy files in Rego and save them in your project directory.
3. Run InfraGuard with the custom policy:

   ```bash
   infraguard validate --policy your-policy.rego your-template.yaml
   ```

## 📞 Support

If you have questions or need assistance, you can reach out via the GitHub Issues page. Provide details about your problem, and we'll assist you.

---

With InfraGuard, securing your infrastructure becomes a straightforward process. Start validating your templates today to ensure a reliable deployment on Alibaba Cloud. Download now and protect your applications!