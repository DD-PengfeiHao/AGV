# -*- coding: utf-8 -*-
# Author:
# version:
# Time:
# description:
# update:

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/syspy")

from rbk import BasicModule, ParamServer
from rbkSim import SimModule


class Module(BasicModule):
    def __init__(self, r: SimModule, args):
        super(Module, self).__init__()
        p = ParamServer(__file__)

        self.param1 = p.loadParam(
            name="param1",    # 参数名称
            type="int",       # 参数数据类型
            default=0,        # 参数默认值
            minValue=-1,      # 参数最小值
            maxValue=100,     # 参数最大值
            unit="",          # 参数单位
            group="group1",   # 参数类别，分类展示用
            comment="param1"  # 参数说明
        )
        self.param2 = p.loadParam(
            name="param2",    # 参数名称
            type="float",     # 参数数据类型
            default=0,        # 参数默认值
            minValue=-2,      # 参数最小值
            maxValue=2,       # 参数最大值
            unit="m",         # 参数单位
            group="group1",   # 参数类别，分类展示用
            comment="param2"  # 参数说明
        )
        self.param3 = p.loadParam(
            name="param3",
            type="int",
            default=-1,
            minValue=-1,
            maxValue=100,
            group="group2",
            comment="param3"
        )
        self.param4 = p.loadParam(
            name="param4",
            type="str",
            default="None",
            group="group2",
            comment="param4"
        )

    def run(self, r: SimModule, args):
        pass


# 使用可视化参数配置，必须在脚本中增加main，并在main中实例化module类
if __name__ == '__main__':
    r1 = SimModule()
    args = {}
    m = Module(r1, args)
    r1.logInfo(f"{m}")
