"""课堂探测车：Pico / MicroPython / Pololu DRV8833。

上传后不会自动行驶。先按 build-guide.md 断电接线和架空测试。
仅验证过模拟逻辑，尚未完成实机验证。停止为 PWM 归零滑行，不保证瞬间刹停。
"""
from machine import Pin, PWM
from time import sleep_ms, ticks_ms, ticks_diff

MAX_DUTY = 0.35
MAX_RUN_MS = 3000
LEFT_SIGN = 1   # 架空测试后，按实际轮子方向改为 -1 或 1
RIGHT_SIGN = -1

# 常闭 COM—NC 回路：未触碰时接地；按下或断线时变为高电平。
left_contact = Pin(10, Pin.IN, Pin.PULL_UP)
right_contact = Pin(11, Pin.IN, Pin.PULL_UP)
channels = []
armed = False
for gpio in (2, 3, 4, 5):
    pin = Pin(gpio, Pin.OUT, value=0)
    pwm = PWM(pin)
    pwm.freq(1000)
    pwm.duty_u16(0)
    channels.append(pwm)


def stop():
    """立即撤销驱动，并要求下一次动作重新确认。"""
    global armed
    for pwm in channels:
        pwm.duty_u16(0)
    armed = False


def contact_open():
    return bool(left_contact.value() or right_contact.value())


def arm():
    """仅在成人确认测试区、两个触碰回路闭合后调用。"""
    global armed
    stop()
    if contact_open():
        raise RuntimeError('触碰开关已触发或断线，不能启动')
    armed = True


def _wheel(a, b, speed):
    # 先将两路置零，再改变方向，避免同时驱动两个方向。
    channels[a].duty_u16(0)
    channels[b].duty_u16(0)
    duty = int(min(abs(speed), MAX_DUTY) * 65535)
    channels[a if speed >= 0 else b].duty_u16(duty)


def move(left, right, duration_ms):
    """最多三秒的单次动作；异常、触碰、断线、Ctrl-C 均撤销 PWM。"""
    try:
        if not armed:
            raise RuntimeError('每次动作前先检查场地并调用 arm()')
        if not isinstance(duration_ms, int) or not 1 <= duration_ms <= MAX_RUN_MS:
            raise ValueError('持续时间必须是 1 至 3000 的整数毫秒')
        if not (-1 <= left <= 1 and -1 <= right <= 1):
            raise ValueError('轮速须在 -1 与 1 之间')
        if contact_open():
            raise RuntimeError('触碰开关触发或断线')
        _wheel(0, 1, left * LEFT_SIGN)
        _wheel(2, 3, right * RIGHT_SIGN)
        started = ticks_ms()
        while ticks_diff(ticks_ms(), started) < duration_ms:
            if contact_open():
                return 'contact-stop'
            sleep_ms(10)
        return 'time-stop'
    finally:
        stop()


def forward(duration_ms=300):
    return move(0.25, 0.25, duration_ms)


def turn(duration_ms=200):
    return move(0.20, -0.20, duration_ms)


stop()
# REPL 中逐条执行：import controller as car; car.arm(); car.forward(300)
# 测量后再改变时间；turn(200) 并不保证转 90 度。
