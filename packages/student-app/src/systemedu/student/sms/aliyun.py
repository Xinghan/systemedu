"""阿里云短信发送封装 (新版 SDK dysmsapi20170525)。

配置全走 env, 代码库零明文密钥:
  ALIYUN_SMS_KEY / ALIYUN_SMS_SECRET  — AccessKey (仅生产 secrets 文件)
  ALIYUN_SMS_ENDPOINT  默认 dysmsapi.aliyuncs.com
  ALIYUN_SMS_SIGN      签名 (北京星健健康科技咨询)
  ALIYUN_SMS_TEMPLATE  模板 (SMS_501786105)
  ALIYUN_SMS_DEBUG     true 时不真发, 打日志 (默认 false)
频次/IP 限制由阿里云后台配置。
"""
from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)

ENDPOINT = os.environ.get("ALIYUN_SMS_ENDPOINT", "dysmsapi.aliyuncs.com")
SIGN = os.environ.get("ALIYUN_SMS_SIGN", "北京星健健康科技咨询")
TEMPLATE = os.environ.get("ALIYUN_SMS_TEMPLATE", "SMS_501786105")
DEBUG = os.environ.get("ALIYUN_SMS_DEBUG", "false").lower() == "true"


def _build_client():
    from alibabacloud_dysmsapi20170525.client import Client
    from alibabacloud_tea_openapi import models as open_api_models

    config = open_api_models.Config(
        access_key_id=os.environ["ALIYUN_SMS_KEY"],
        access_key_secret=os.environ["ALIYUN_SMS_SECRET"],
        endpoint=ENDPOINT,
    )
    return Client(config)


def send_sms_code(phone: str, code: str) -> bool:
    """发送验证码短信。debug 模式只打日志。返回是否成功。"""
    if DEBUG:
        logger.warning("[SMS DEBUG] phone=%s code=%s (未真发)", phone, code)
        return True
    try:
        from alibabacloud_dysmsapi20170525 import models as sms_models
        client = _build_client()
        req = sms_models.SendSmsRequest(
            phone_numbers=phone,
            sign_name=SIGN,
            template_code=TEMPLATE,
            template_param=json.dumps({"code": code}),
        )
        resp = client.send_sms(req)
        ok = getattr(resp.body, "code", "") == "OK"
        if not ok:
            logger.error("阿里云短信发送失败: %s", getattr(resp.body, "message", resp.body))
        return ok
    except Exception:
        logger.exception("阿里云短信发送异常 phone=%s", phone)
        return False
