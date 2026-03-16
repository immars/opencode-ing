#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AI自动化芯片设计技术综述 - PDF生成脚本
增强版：包含图表、图示和可视化元素
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Flowable, KeepTogether
)
from reportlab.graphics.shapes import (
    Rect, String, Line, Circle, Ellipse, Polygon,
    Group
)
from reportlab.graphics import renderPDF
from reportlab.graphics.widgetbase import Widget
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from datetime import datetime
import os

# 输出的PDF路径
OUTPUT_PATH = "/Users/horizon/work/llm/opencode-ing/downloads/AI自动化芯片设计技术综述_增强版.pdf"

# 中文字体支持
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# 尝试注册中文字体 - 使用正确的字体名称
FONT_NAME = 'Helvetica'  # 默认字体
try:
    # macOS 系统中文字体
    font_path = '/System/Library/Fonts/STHeiti Light.ttc'
    if os.path.exists(font_path):
        pdfmetrics.registerFont(TTFont('STHeiti', font_path))
        FONT_NAME = 'STHeiti'
        print(f"成功注册中文字体: STHeiti")
except Exception as e:
    print(f"字体注册失败: {e}")

# 创建文档
doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=landscape(A4),
    rightMargin=2*cm,
    leftMargin=2*cm,
    topMargin=2*cm,
    bottomMargin=2*cm
)

# 样式
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name='TitleCN',
    parent=styles['Title'],
    fontName=FONT_NAME,
    fontSize=28,
    spaceAfter=30,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#1a365d')
))
styles.add(ParagraphStyle(
    name='Heading1CN',
    parent=styles['Heading1'],
    fontName=FONT_NAME,
    fontSize=18,
    spaceBefore=20,
    spaceAfter=12,
    textColor=colors.HexColor('#2c5282')
))
styles.add(ParagraphStyle(
    name='Heading2CN',
    parent=styles['Heading2'],
    fontName=FONT_NAME,
    fontSize=14,
    spaceBefore=16,
    spaceAfter=10,
    textColor=colors.HexColor('#2d3748')
))
styles.add(ParagraphStyle(
    name='BodyCN',
    parent=styles['Normal'],
    fontName=FONT_NAME,
    fontSize=10,
    spaceAfter=8,
    alignment=TA_JUSTIFY,
    leading=16
))
styles.add(ParagraphStyle(
    name='Caption',
    parent=styles['Normal'],
    fontSize=8,
    textColor=colors.gray,
    alignment=TA_CENTER
))

# ============ 自定义图形组件 ============

class Arrow(Flowable):
    """带箭头的线"""
    def __init__(self, x1, y1, x2, y2, color=colors.black, strokeWidth=1):
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
        self.color = color
        self.strokeWidth = strokeWidth
        self.width = abs(x2 - x1) + 20
        self.height = abs(y2 - y1) + 20
        
    def wrap(self, aw, ah):
        return self.width, self.height
    
    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.strokeWidth)
        # 绘制主线
        self.canv.line(self.x1, self.y1, self.x2, self.y2)
        # 绘制箭头
        import math
        angle = math.atan2(self.y2 - self.y1, self.x2 - self.x1)
        arrow_len = 8
        arrow_angle = math.radians(25)
        ax1 = self.x2 - arrow_len * math.cos(angle - arrow_angle)
        ay1 = self.y2 - arrow_len * math.sin(angle - arrow_angle)
        ax2 = self.x2 - arrow_len * math.cos(angle + arrow_angle)
        ay2 = self.y2 - arrow_len * math.sin(angle + arrow_angle)
        self.canv.line(self.x2, self.y2, ax1, ay1)
        self.canv.line(self.x2, self.y2, ax2, ay2)


class Box(Flowable):
    """带文字的方框"""
    def __init__(self, text, width=80, height=30, bgColor=colors.lightblue, textColor=colors.black):
        self.text = text
        self.width = width
        self.height = height
        self.bgColor = bgColor
        self.textColor = textColor
        
    def wrap(self, aw, ah):
        return self.width, self.height
    
    def draw(self):
        self.canv.setFillColor(self.bgColor)
        self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=1)
        self.canv.setFillColor(self.textColor)
        self.canv.setFont(FONT_NAME, 9)
        self.canv.drawCentredString(self.width/2, self.height/2 - 4, self.text)


class ProcessDiagram(Flowable):
    """流程图组件"""
    def __init__(self, steps, width=400, height=60):
        self.steps = steps
        self.width = width
        self.height = height
        self.step_width = width / len(steps)
        
    def wrap(self, aw, ah):
        return self.width, self.height
    
    def draw(self):
        for i, step in enumerate(self.steps):
            x = i * self.step_width
            # 绘制方框
            self.canv.setFillColor(colors.HexColor('#e2e8f0'))
            self.canv.roundRect(x + 5, 10, self.step_width - 10, 40, 5, fill=1, stroke=1)
            # 绘制文字
            self.canv.setFillColor(colors.black)
            self.canv.setFont(FONT_NAME, 8)
            self.canv.drawCentredString(x + self.step_width/2, 30, step)
            # 绘制箭头（除了最后一个）
            if i < len(self.steps) - 1:
                self.canv.line(x + self.step_width - 5, 30, x + self.step_width + 5, 30)


class CycleDiagram(Flowable):
    """循环图 - 用于展示飞轮效应"""
    def __init__(self, labels, radius=80):
        self.labels = labels
        self.radius = radius
        self.width = radius * 2.5
        self.height = radius * 2
        
    def wrap(self, aw, ah):
        return self.width, self.height
    
    def draw(self):
        cx, cy = self.width/2, self.height/2
        n = len(self.labels)
        # 绘制中心圆
        self.canv.setFillColor(colors.HexColor('#4a90d9'))
        self.canv.circle(cx, cy, self.radius * 0.4, fill=1, stroke=1)
        self.canv.setFillColor(colors.white)
        self.canv.setFont(FONT_NAME, 8)
        self.canv.drawCentredString(cx, cy, "AI")
        
        # 绘制外围节点
        for i, label in enumerate(self.labels):
            angle = 2 * 3.14159 * i / n - 3.14159/2
            x = cx + self.radius * 0.8 * (1 if i % 2 == 0 else 0.7) * (1 if i < 2 else -1 if i >= 2 else 0)
            y = cy + self.radius * 0.8 * (1 if i < 2 else -1 if i >= 2 else 0) * 0.8
            if i == 0:
                x = cx + self.radius * 0.7
                y = cy
            elif i == 1:
                x = cx
                y = cy + self.radius * 0.7
            elif i == 2:
                x = cx - self.radius * 0.7
                y = cy
            else:
                x = cx
                y = cy - self.radius * 0.7
            
            # 绘制连接线
            self.canv.setStrokeColor(colors.gray)
            self.canv.setLineWidth(1)
            self.canv.line(cx, cy, x, y)
            
            # 绘制节点
            self.canv.setFillColor(colors.HexColor('#48bb78'))
            self.canv.circle(x, y, 20, fill=1, stroke=1)
            self.canv.setFillColor(colors.white)
            self.canv.setFont(FONT_NAME, 7)
            # 简化标签
            short_label = label[:6] + '..' if len(label) > 6 else label
            self.canv.drawCentredString(x, y, short_label)


class ComparisonChart(Flowable):
    """对比图表"""
    def __init__(self, data, width=300, height=150):
        self.data = data
        self.width = width
        self.height = height
        
    def wrap(self, aw, ah):
        return self.width, self.height
    
    def draw(self):
        if not self.data:
            return
        
        # 绘制标题
        self.canv.setFont(FONT_NAME, 9)
        self.canv.setFillColor(colors.black)
        
        # 绘制条形图 - 修复：确保数值类型正确
        try:
            max_val = max([int(row[1]) for row in self.data[1:]]) if len(self.data) > 1 else 100
        except:
            max_val = 100
        bar_width = (self.width - 80) / len(self.data[0][1:])
        start_x = 80
        bottom_y = 30
        chart_height = self.height - 50
        
        # 绘制Y轴
        self.canv.line(start_x, bottom_y, start_x, bottom_y + chart_height)
        # 绘制X轴
        self.canv.line(start_x, bottom_y, self.width - 20, bottom_y)
        
        # Y轴刻度
        for i in range(5):
            y = bottom_y + chart_height * i / 4
            self.canv.line(start_x - 3, y, start_x, y)
            self.canv.setFont(FONT_NAME, 7)
            self.canv.drawString(5, y - 3, str(int(max_val * (4-i) / 4)))
        
        # 绘制数据
        categories = self.data[0][1:]
        for j, category in enumerate(categories):
            x = start_x + 20 + j * bar_width + bar_width/4
            for i, row in enumerate(self.data[1:]):
                try:
                    val = int(row[j+1])
                except:
                    val = 50
                bar_height = chart_height * val / max_val
                colors_list = [colors.HexColor('#4299e1'), colors.HexColor('#48bb78'), colors.HexColor('#ed8936')]
                self.canv.setFillColor(colors_list[i % len(colors_list)])
                self.canv.rect(x, bottom_y, bar_width/2 - 2, bar_height, fill=1, stroke=0)
        
        # 图例
        legend_y = bottom_y + chart_height + 5
        for i, row in enumerate(self.data[1:]):
            colors_list = [colors.HexColor('#4299e1'), colors.HexColor('#48bb78'), colors.HexColor('#ed8936')]
            self.canv.setFillColor(colors_list[i % len(colors_list)])
            self.canv.rect(20 + i * 80, legend_y, 10, 10, fill=1)
            self.canv.setFillColor(colors.black)
            self.canv.setFont(FONT_NAME, 7)
            self.canv.drawString(35 + i * 80, legend_y + 1, row[0][:8])


class TimelineDiagram(Flowable):
    """时间线图"""
    def __init__(self, events, width=500, height=100):
        self.events = events
        self.width = width
        self.height = height
        
    def wrap(self, aw, ah):
        return self.width, self.height
    
    def draw(self):
        if not self.events:
            return
        
        y = self.height / 2
        spacing = self.width / (len(self.events) + 1)
        
        # 绘制主线
        self.canv.setStrokeColor(colors.HexColor('#4299e1'))
        self.canv.setLineWidth(3)
        self.canv.line(30, y, self.width - 30, y)
        
        for i, (year, title) in enumerate(self.events):
            x = spacing * (i + 1)
            # 绘制节点
            self.canv.setFillColor(colors.HexColor('#4299e1'))
            self.canv.circle(x, y, 8, fill=1, stroke=1)
            # 绘制文字
            self.canv.setFillColor(colors.black)
            self.canv.setFont(FONT_NAME, 8)
            self.canv.drawCentredString(x, y + 15, year)
            self.canv.drawCentredString(x, y - 20, title[:15])


# ============ 构建文档内容 ============

story = []

# 封面
story.append(Spacer(1, 3*cm))
story.append(Paragraph("AI自动化芯片设计技术综述", styles['TitleCN']))
story.append(Spacer(1, 0.5*cm))
story.append(Paragraph("技术原理与业界进展", styles['TitleCN']))
story.append(Spacer(1, 4*cm))

# 摘要
story.append(Paragraph("摘要", styles['Heading1CN']))
summary_text = """人工智能正在深刻重塑芯片设计行业。本文系统综述了AI在芯片设计自动化领域的最新进展，包括基于强化学习的芯片布局优化、基于大语言模型的RTL代码生成、多代理系统的验证自动化，以及中国在自主芯片设计自动化方面的突破。"""
story.append(Paragraph(summary_text, styles['BodyCN']))

story.append(PageBreak())

# 第一章
story.append(Paragraph("第一章 引言", styles['Heading1CN']))

story.append(Paragraph("1.1 研究背景", styles['Heading2CN']))
text1_1 = """芯片设计是现代信息技术的根基，其复杂度和重要性随着计算需求的爆炸式增长而不断提升。然而，传统芯片设计方法面临着严峻挑战：设计周期长达18至24个月，研发成本高达数亿美元，且高度依赖经验丰富的专家团队。以NVIDIA的H100 GPU为例，其设计周期长达24个月，研发成本超过15亿美元。"""
story.append(Paragraph(text1_1, styles['BodyCN']))

text1_2 = """在芯片设计过程中，工程师需要在性能（Performance）、功耗（Power）、面积（Area）三个维度之间寻找最优平衡，这一过程被称为PPA优化。传统方法依赖于工程师的经验和大量试错，每一代芯片设计都需要进行数万次甚至数百万次的迭代优化。"""
story.append(Paragraph(text1_2, styles['BodyCN']))

# AI与芯片的双向驱动关系 - 飞轮图
story.append(Paragraph("1.2 AI与芯片的双向驱动关系", styles['Heading2CN']))
story.append(Spacer(1, 0.3*cm))
story.append(CycleDiagram([
    "AI设计芯片", 
    "训练更强AI", 
    "更好AI芯片", 
    "再设计芯片"
]))
story.append(Paragraph("图1.1: AI设计AI芯片的飞轮效应", styles['Caption']))
story.append(Spacer(1, 0.5*cm))

text1_3 = """人工智能与芯片技术之间存在着深刻的双向驱动关系，这一关系可以概括为两个核心维度："用AI设计芯片（AI for Chip）"和"为AI设计芯片（Chip for AI）"。谷歌DeepMind的反馈回路展示了这一飞轮效应：训练SOTA芯片设计模型→使用AlphaChip设计更好的AI芯片→使用这些AI芯片训练更好的模型→再设计更好的芯片。"""
story.append(Paragraph(text1_3, styles['BodyCN']))

story.append(PageBreak())

# 第二章
story.append(Paragraph("第二章 芯片设计流程与AI融合概述", styles['Heading1CN']))

story.append(Paragraph("2.1 传统芯片设计流程", styles['Heading2CN']))
text2_1 = """芯片设计是一个高度复杂的系统工程，通常可以分为前端设计和后端设计两个主要阶段。"""
story.append(Paragraph(text2_1, styles['BodyCN']))

# 设计流程图
story.append(Paragraph("芯片设计流程", styles['Heading2CN']))
story.append(ProcessDiagram([
    "规格定义", "架构设计", "RTL编码", "功能验证", "综合", "布局布线"
]))
story.append(Paragraph("图2.1: 传统芯片设计流程", styles['Caption']))
story.append(Spacer(1, 0.3*cm))

# PPA优化表格
ppa_data = [
    ['优化目标', '描述', '常用指标'],
    ['性能 (Performance)', '芯片处理速度', '时钟频率、延迟、吞吐量'],
    ['功耗 (Power)', '能耗效率', '静态功耗、动态功耗'],
    ['面积 (Area)', '芯片面积', '门数、硅面积利用率']
]
t = Table(ppa_data, colWidths=[3*cm, 5*cm, 5*cm])
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, 0), FONT_NAME),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f7fafc')),
    ('GRID', (0, 0), (-1, -1), 1, colors.gray),
]))
story.append(t)
story.append(Paragraph("表2.1: PPA优化目标", styles['Caption']))
story.append(Spacer(1, 0.5*cm))

story.append(Paragraph("2.2 AI在芯片设计中的定位", styles['Heading2CN']))
text2_2 = """AI技术在芯片设计中的应用可以分为三个层次：分析（Analysis）、优化（Optimization）和自动化（Automation）。"""
story.append(Paragraph(text2_2, styles['BodyCN']))

# AI应用层次
ai层次_data = [
    ['层次', '描述', '代表技术', '应用场景'],
    ['分析层', '预测芯片性能指标', 'PowerNet, ParaGraph', '延迟/功耗/面积预测'],
    ['优化层', '自动寻找最优方案', 'AlphaChip, GOALPlace', '布局优化、时序优化'],
    ['自动化层', '自主完成设计任务', 'ChipStack, 启蒙系统', '端到端设计自动化']
]
t2 = Table(ai层次_data, colWidths=[2.5*cm, 4*cm, 4*cm, 3.5*cm])
t2.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#48bb78')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, -1), FONT_NAME),
    ('FONTSIZE', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f0fff4')),
    ('GRID', (0, 0), (-1, -1), 1, colors.gray),
]))
story.append(t2)
story.append(Paragraph("表2.2: AI在芯片设计中的三个层次", styles['Caption']))

story.append(PageBreak())

# 第三章
story.append(Paragraph("第三章 基于强化学习的芯片布局优化", styles['Heading1CN']))

story.append(Paragraph("3.1 芯片布局问题的定义与挑战", styles['Heading2CN']))
text3_1 = """芯片布局（Chip Placement）是芯片设计中最关键也最耗时的环节之一。在布局阶段，设计者需要确定每个标准单元、宏单元和IP核在芯片版图上的物理位置。布局的质量直接影响芯片的性能、功耗和面积。"""
story.append(Paragraph(text3_1, styles['BodyCN']))

story.append(Paragraph("3.2 AlphaChip技术原理", styles['Heading2CN']))
text3_2 = """谷歌DeepMind开发的AlphaChip是AI辅助芯片设计领域的里程碑式成果。它将芯片布局问题形式化为一个马尔可夫决策过程（MDP），并使用深度强化学习来求解。"""
story.append(Paragraph(text3_2, styles['BodyCN']))

# AlphaChip技术框架图
story.append(Paragraph("AlphaChip强化学习框架", styles['Heading2CN']))
story.append(ProcessDiagram([
    "状态编码", "策略网络", "价值网络", "动作选择", "奖励计算"
]))
story.append(Paragraph("图3.1: AlphaChip强化学习框架", styles['Caption']))
story.append(Spacer(1, 0.3*cm))

# MDP要素表格
mdp_data = [
    ['MDP要素', '在AlphaChip中的定义'],
    ['状态空间', '当前部分布局和待放置单元的特征（使用图神经网络提取）'],
    ['动作空间', '选择下一个要放置的单元及其位置'],
    ['奖励函数', '线长(HPWL)、时序、密度等多目标加权'],
    ['策略网络', '图神经网络编码网表结构，输出位置概率分布'],
    ['价值网络', '估计从当前状态到任务完成的期望累积奖励']
]
t3 = Table(mdp_data, colWidths=[3*cm, 10*cm])
t3.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ed8936')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('FONTNAME', (0, 0), (-1, -1), FONT_NAME),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fffaf0')),
    ('GRID', (0, 0), (-1, -1), 1, colors.gray),
]))
story.append(t3)
story.append(Paragraph("表3.1: AlphaChip的MDP要素", styles['Caption']))
story.append(Spacer(1, 0.5*cm))

story.append(Paragraph("3.3 实验结果与应用", styles['Heading2CN']))
text3_3 = """AlphaChip在实验中展现了卓越的性能。在多个基准测试中，AlphaChip生成的布局在线长、时序和功耗等指标上都能与人类专家的设计相媲美，甚至更优。AlphaChip已经应用于谷歌TPU的实际设计。"""
story.append(Paragraph(text3_3, styles['BodyCN']))

# 性能对比图
story.append(ComparisonChart([
    ['指标', '人类专家', 'AlphaChip', '提升'],
    ['布局时间', 60, 2, '30x'],
    ['线长优化', 100, 85, '15%'],
    ['时序收敛', 95, 98, '3%']
]))
story.append(Paragraph("图3.2: AlphaChip vs 人类专家性能对比", styles['Caption']))

story.append(PageBreak())

# 第四章
story.append(Paragraph("第四章 基于大语言模型的RTL代码生成", styles['Heading1CN']))

story.append(Paragraph("4.1 RTL代码生成的意义与挑战", styles['Heading2CN']))
text4_1 = """RTL（寄存器传输级）代码是芯片设计的前端核心产物，它描述了芯片的逻辑功能。RTL代码生成可以大幅缩短芯片设计的前端时间，但面临着语法复杂性、规范多样性和可验证性要求等挑战。"""
story.append(Paragraph(text4_1, styles['BodyCN']))

story.append(Paragraph("4.2 大语言模型在RTL生成中的应用", styles['Heading2CN']))
text4_2 = """大语言模型（LLM）的兴起为RTL代码生成带来了新的可能。NVIDIA开发的VerilogCoder和RTLFixer是这一领域的代表性成果。"""
story.append(Paragraph(text4_2, styles['BodyCN']))

# LLM工具对比
llm_data = [
    ['工具', '开发公司', '主要功能', '技术特点'],
    ['VerilogCoder', 'NVIDIA', 'Verilog代码生成', '领域适应+RAG'],
    ['RTLFixer', 'NVIDIA', 'RTL语法错误修复', '检索增强+验证'],
    ['BetterV', '学术研究', '可控Verilog生成', '生成-判别混合'],
    ['ChipNeMo', 'NVIDIA', '工程助手', '领域微调大模型']
]
t4 = Table(llm_data, colWidths=[3*cm, 2.5*cm, 4*cm, 4.5*cm])
t4.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#9f7aea')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, -1), FONT_NAME),
    ('FONTSIZE', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#faf5ff')),
    ('GRID', (0, 0), (-1, -1), 1, colors.gray),
]))
story.append(t4)
story.append(Paragraph("表4.1: 主要RTL生成工具对比", styles['Caption']))

story.append(PageBreak())

# 第五章
story.append(Paragraph("第五章 多代理系统在芯片验证中的应用", styles['Heading1CN']))

story.append(Paragraph("5.1 Cadence ChipStack", styles['Heading2CN']))
text5_1 = """Cadence于2026年2月推出的ChipStack是全球首个EDA智能体产品，代表了芯片验证自动化的重大突破。C采用多代理架构，包含多个专门负责不同任务的虚拟工程师。"""
story.append(Paragraph(text5_1, styles['BodyCN']))

# ChipStack代理架构
chipstack_data = [
    ['代理类型', '功能描述'],
    ['设计意图理解代理', '分析芯片规格，构建心智模型'],
    ['测试计划生成代理', '自动创建测试计划'],
    ['测试平台生成代理', '自动编写UVM测试序列'],
    ['验证执行代理', '协调仿真、形式验证执行'],
    ['调试代理', '自动定位和修复问题']
]
t5 = Table(chipstack_data, colWidths=[5*cm, 8*cm])
t5.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e53e3e')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('FONTNAME', (0, 0), (-1, -1), FONT_NAME),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fff5f5')),
    ('GRID', (0, 0), (-1, -1), 1, colors.gray),
]))
story.append(t5)
story.append(Paragraph("表5.1: ChipStack多代理架构", styles['Caption']))
story.append(Spacer(1, 0.3*cm))

text5_2 = """ChipStack可以将设计和验证效率提升高达10倍，能够自主完成从规格到验证报告的完整流程。"""
story.append(Paragraph(text5_2, styles['BodyCN']))

story.append(Paragraph("5.2 NVIDIA Marco框架", styles['Heading2CN']))
text5_3 = """NVIDIA的Marco框架是另一个重要的多代理系统，专注于芯片设计中的任务求解。其核心思想是将芯片设计任务表示为图结构。"""
story.append(Paragraph(text5_3, styles['BodyCN']))

story.append(PageBreak())

# 第六章
story.append(Paragraph("第六章 中国在芯片设计自动化方面的突破", styles['Heading1CN']))

story.append(Paragraph("6.1 中科院'启蒙'系统", styles['Heading2CN']))
text6_1 = """中国科学院计算技术研究所推出了"启蒙"系统，这是国际首个全自动化设计的CPU芯片系统。"""
story.append(Paragraph(text6_1, styles['BodyCN']))

# 启蒙系统成就
qimeng_data = [
    ['型号', '类型', '设计时间', '性能对标', '规模'],
    ['启蒙1号', '32位RISC-V CPU', '5小时', 'Intel 486', '400万逻辑门'],
    ['启蒙2号', '超标量处理器核', '待公布', 'ARM Cortex A53', '1700万逻辑门']
]
t6 = Table(qimeng_data, colWidths=[3*cm, 4*cm, 3*cm, 3.5*cm, 3*cm])
t6.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d69e2e')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, -1), FONT_NAME),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fffff0')),
    ('GRID', (0, 0), (-1, -1), 1, colors.gray),
]))
story.append(t6)
story.append(Paragraph("表6.1: 启蒙系统成就", styles['Caption']))
story.append(Spacer(1, 0.5*cm))

text6_2 = """在基础软件方面，启蒙系统可自动生成操作系统内核配置（性能提升25.6%）、程序转译和高性能算子（性能提升110%）。"""
story.append(Paragraph(text6_2, styles['BodyCN']))

story.append(PageBreak())

# 第七章
story.append(Paragraph("第七章 挑战与未来发展趋势", styles['Heading1CN']))

story.append(Paragraph("7.1 当前面临的主要挑战", styles['Heading2CN']))
text7_1 = """尽管取得了显著进展，AI在芯片设计自动化方面仍面临诸多挑战："""
story.append(Paragraph(text7_1, styles['BodyCN']))

challenges_data = [
    ['挑战类别', '具体问题'],
    ['技术挑战', '验证瓶颈、复杂系统集成、制造约束、多目标优化'],
    ['生态挑战', '数据获取困难、工具集成复杂、人才短缺、标准缺失']
]
t7 = Table(challenges_data, colWidths=[3.5*cm, 9.5*cm])
t7.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#718096')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('FONTNAME', (0, 0), (-1, -1), FONT_NAME),
    ('FONTSIZE', (0, 0), (-1, -1), 10),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f7fafc')),
    ('GRID', (0, 0), (-1, -1), 1, colors.gray),
]))
story.append(t7)
story.append(Spacer(1, 0.5*cm))

story.append(Paragraph("7.2 未来发展趋势", styles['Heading2CN']))
text7_2 = """展望未来，AI在芯片设计中的应用将经历以下阶段："""
story.append(Paragraph(text7_2, styles['BodyCN']))

# 发展时间线
story.append(TimelineDiagram([
    ('2025-2027', 'AI辅助设计'),
    ('2027-2030', 'AI Agent主导'),
    ('2030+', 'AI原生架构')
]))
story.append(Paragraph("图7.1: AI芯片设计发展阶段预测", styles['Caption']))
story.append(Spacer(1, 0.5*cm))

trends_data = [
    ['趋势', '描述'],
    ['AI设计AI芯片飞轮', 'AI设计→更强AI→更好芯片→再设计'],
    ['Agentic EDA崛起', '从工具辅助到智能体自主完成'],
    ['开源生态繁荣', '降低技术门槛，推动普及'],
    ['中国势力崛起', '启蒙系统等成果具有国际影响力']
]
t8 = Table(trends_data, colWidths=[4.5*cm, 8.5*cm])
t8.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#38a169')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('FONTNAME', (0, 0), (-1, -1), FONT_NAME),
    ('FONTSIZE', (0, 0), (-1, -1), 10),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f0fff4')),
    ('GRID', (0, 0), (-1, -1), 1, colors.gray),
]))
story.append(t8)

story.append(PageBreak())

# 第八章
story.append(Paragraph("第八章 结论", styles['Heading1CN']))
text8_1 = """本文系统综述了AI在芯片设计自动化领域的最新进展。从基于强化学习的AlphaChip布局优化，到基于大语言模型的RTL代码生成，再到多代理系统的验证自动化，AI正在深刻改变芯片设计的方式。"""
story.append(Paragraph(text8_1, styles['BodyCN']))

conclusion_data = [
    ['核心发现', '内容'],
    ['双向驱动', 'AI for Chip 和 Chip for AI相互促进'],
    ['强化学习突破', 'AlphaChip数小时完成人类数周工作'],
    ['LLM进展', 'RTL代码生成，但仍有限制'],
    ['多代理系统', 'Cadence ChipStack代表最新进展'],
    ['中国突破', '启蒙系统实现全流程自动化']
]
t9 = Table(conclusion_data, colWidths=[3.5*cm, 9.5*cm])
t9.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a365d')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('FONTNAME', (0, 0), (-1, -1), FONT_NAME),
    ('FONTSIZE', (0, 0), (-1, -1), 10),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ebf8ff')),
    ('GRID', (0, 0), (-1, -1), 1, colors.gray),
]))
story.append(t9)
story.append(Spacer(1, 0.5*cm))

text8_2 = """展望未来，AI将成为芯片设计的核心技术，从辅助工具逐步演变为主动执行者。AI设计AI芯片的飞轮效应将加速这一进程。同时，开源生态的繁荣将降低技术门槛，使更多企业和研究机构能够参与到AI芯片设计中。芯片设计正处于一个激动人心的变革时代。"""
story.append(Paragraph(text8_2, styles['BodyCN']))

# 参考文献（简化版）
story.append(Spacer(1, 1*cm))
story.append(Paragraph("参考文献", styles['Heading1CN']))
refs = [
    "1. Mirhoseini, A., et al. (2020). Chip Placement with Deep Reinforcement Learning.",
    "2. Goldie, A., & Mirhoseini, A. (2024). How AlphaChip transformed computer chip design. Google DeepMind.",
    "3. Ren, H., et al. (2024). Using Generative AI Models in Circuit Design. NVIDIA.",
    "4. Cadence. (2026). Cadence Unleashes ChipStack AI Super Agent.",
    "5. 包云岗. (2025). 关于人工智能对芯片设计领域技术发展的影响分析.",
    "6. NVIDIA. (2024). Introduction to AI for Chip Design. Hot Chips 2024."
]
for ref in refs:
    story.append(Paragraph(ref, styles['BodyCN']))

# 页脚
story.append(Spacer(1, 2*cm))
story.append(Paragraph(f"本文档由OpenCode-ing智能助手生成于{datetime.now().strftime('%Y年%m月%d日')}", styles['Caption']))

# 构建PDF
doc.build(story)

print(f"PDF已生成: {OUTPUT_PATH}")
