let selectedModel = 'gpt-3.5-turbo';
let currentModelInfo = null;
let models = []; // 在文件顶部声明

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const submitBtn = document.getElementById('submitBtn');
    const modelSelect = document.getElementById('modelSelect');

    uploadForm.addEventListener('submit', handleFileUpload);
    submitBtn.addEventListener('click', submitToAI);
    modelSelect.addEventListener('change', updateModelInfo);

    fetchModels();
});

function fetchModels() {
    console.log('Fetching models...');
    fetch('/models')
        .then(response => response.json())
        .then(data => {
            console.log('Received models:', data);
            models = data; // 保存到全局变量
            const modelSelect = document.getElementById('modelSelect');
            modelSelect.innerHTML = ''; // 清空现有选项
            data.forEach(model => {
                console.log('Adding model:', model.name);
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });
            console.log('Models added to select');
            updateModelInfo(); // 初始化模型信息显示
        })
        .catch(error => {
            console.error('Error fetching models:', error);
            addLog('获取模型列表失败: ' + error, 'error');
        });
}

function updateModelInfo() {
    const modelSelect = document.getElementById('modelSelect');
    selectedModel = modelSelect.value;
    const modelInfo = document.getElementById('modelInfo');
    // 不需要重新获模型列表,直接使用已经获取的数据
    const currentModelInfo = models.find(m => m.name === selectedModel);
    if (currentModelInfo) {
        modelInfo.innerHTML = `输入价格: ¥${currentModelInfo.input_price}/1k tokens<br>输出价格: ¥${currentModelInfo.output_price}/1k tokens`;
    } else {
        modelInfo.innerHTML = '无法获取模型价格信息';
    }
}

function submitToAI() {
    const prompts = generatePromptCombinations();
    processPrompts(prompts);
}

function generatePromptCombinations() {
    const table = document.querySelector('#excelContent table');
    const selectedCells = table.querySelectorAll('.selected-cell');
    const columnSelections = {};
    const isNewlineMode = document.getElementById('newlineSwitch').checked;
    const insertHeader = document.getElementById('insertHeaderSwitch').checked;

    // 获取表头
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());

    // 按列分组选中的单元格
    selectedCells.forEach(cell => {
        const columnIndex = cell.cellIndex;
        if (!columnSelections[columnIndex]) {
            columnSelections[columnIndex] = [];
        }
        let cellContent = cell.getAttribute('data-full-text') || cell.textContent.trim();
        if (insertHeader) {
            cellContent = `${headers[columnIndex]}: ${cellContent}`;
        }
        columnSelections[columnIndex].push(cellContent);
    });

    // 生成所有可能的组合
    const columns = Object.keys(columnSelections).sort((a, b) => a - b);
    const combinations = columns.reduce((acc, column) => {
        const newCombinations = [];
        const cellsInColumn = columnSelections[column];
        if (acc.length === 0) {
            return cellsInColumn.map(cell => [cell]);
        }
        acc.forEach(combination => {
            cellsInColumn.forEach(cell => {
                newCombinations.push([...combination, cell]);
            });
        });
        return newCombinations;
    }, []);

    // 将每个组合转换为提示词字符串
    return combinations.map(combination => 
        combination.join(isNewlineMode ? '\n' : ' ')
    );
}

function processPrompts(prompts) {
    prompts.forEach((prompt, index) => {
        addResultRow(prompt, 'pending', new Date().toLocaleString(), '等待处理', '-');
    });

    processNextPrompt(prompts);
}

function processNextPrompt(prompts) {
    if (prompts.length === 0) {
        addLog('所有提示词处理完成');
        return;
    }
    
    const prompt = prompts.shift();
    addLog('正在处理提示词: ' + prompt);
    updateResultStatus(prompt, 'pending', '处理中...', '-');
    
    fetch('/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({prompt: prompt, model: selectedModel})
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const tokenCount = data.token_count;
            updateResultStatus(prompt, 'completed', data.response, tokenCount);
            addLog(`处理完成: 提示词 "${prompt}", Token数: ${tokenCount}`);
            addCellHoverListeners(); // 添加这行
            addCellClickListeners(); // 添加这行
        } else {
            updateResultStatus(prompt, 'error', data.error, '-');
            addLog('处理提示词时出错: ' + data.error, 'error');
        }
        processNextPrompt(prompts);
    })
    .catch(error => {
        updateResultStatus(prompt, 'error', error.toString(), '-');
        addLog('处理示词时出错: ' + error, 'error');
        processNextPrompt(prompts);
    });
}

function truncateText(text, limit = 100) {
    if (text.length <= limit) return text;
    return text.substring(0, limit) + '<span class="ellipsis">...</span>';
}

function updateResultStatus(prompt, status, result, tokenCount) {
    const resultTableBody = document.getElementById('resultTableBody');
    const existingRow = Array.from(resultTableBody.rows).find(row => row.cells[0].getAttribute('data-full-text') === prompt);
    
    if (existingRow) {
        existingRow.cells[1].textContent = getStatusText(status);
        existingRow.cells[1].className = `task-status-${status}`;
        existingRow.cells[2].textContent = new Date().toLocaleString();
        existingRow.cells[3].innerHTML = truncateText(escapeHtml(result));
        existingRow.cells[3].setAttribute('data-full-text', result);
        existingRow.cells[4].textContent = tokenCount;
    } else {
        addResultRow(prompt, status, new Date().toLocaleString(), result, tokenCount);
    }
}

function addResultRow(prompt, status, timestamp, result, tokenCount) {
    const resultTableBody = document.getElementById('resultTableBody');
    const newRow = resultTableBody.insertRow();
    newRow.innerHTML = `
        <td data-full-text="${escapeHtml(prompt)}">${truncateText(escapeHtml(prompt))}</td>
        <td class="task-status-${status}">${getStatusText(status)}</td>
        <td>${timestamp}</td>
        <td data-full-text="${escapeHtml(result)}">${truncateText(escapeHtml(result))}</td>
        <td>${tokenCount}</td>
    `;
}

function getStatusText(status) {
    switch (status) {
        case 'pending': return '等待处理';
        case 'completed': return '已完成';
        case 'error': return '错误';
        default: return status;
    }
}

function addLog(message, type = 'info') {
    const logContent = document.getElementById('logContent');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry text-${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;
}

const style = document.createElement('style');
style.textContent = `
    .selected-cell {
        background-color: #007bff !important;
        color: white;
    }
    
    .ellipsis {
        color: #888;  /* 灰色 */
        font-style: italic;  /* 可选: 使省略号斜体 */
    }
`;
document.head.appendChild(style);

function handleFileUpload(event) {
    event.preventDefault();
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayExcelContent(data.columns, data.data);
                addLog('文件上传成功', 'success');
            } else {
                addLog('上传文件失败: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error uploading file:', error);
            addLog('上传文件失败: ' + error, 'error');
        });
    } else {
        addLog('请选择一个文件上传', 'warning');
    }
}

function displayExcelContent(columns, data) {
    const excelContent = document.getElementById('excelContent');
    let tableHTML = '<table class="table table-bordered table-hover"><thead><tr>';
    
    // 添加表头
    columns.forEach(column => {
        tableHTML += `<th>${column}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    
    // 添加数据行
    data.forEach(row => {
        tableHTML += '<tr>';
        row.forEach(cell => {
            const cellContent = cell ? cell.toString() : '';
            tableHTML += `<td data-full-text="${escapeHtml(cellContent)}">${truncateText(escapeHtml(cellContent))}</td>`;
        });
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    excelContent.innerHTML = tableHTML;
    
    // 显示提交按钮
    document.getElementById('submitBtn').style.display = 'block';
    
    // 添加单元格选择功能
    addCellSelectionListeners();
    
    // 添加鼠标悬停事件监听器
    addCellHoverListeners();
    
    // 添加单元格点击事件监听器
    addCellClickListeners();
}

// 辅助函数：转义HTML特殊字符
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function addCellSelectionListeners() {
    const cells = document.querySelectorAll('#excelContent td');
    cells.forEach(cell => {
        cell.addEventListener('click', function() {
            this.classList.toggle('selected-cell');
            updateSelectionInfo();
        });
    });
}

function updateSelectionInfo() {
    const selectedCells = document.querySelectorAll('.selected-cell');
    const columnSelections = new Set(Array.from(selectedCells).map(cell => cell.cellIndex));
    const totalTasks = calculateTotalTasks(selectedCells);

    const columnSelectionCount = document.getElementById('columnSelectionCount');
    const totalTaskCount = document.getElementById('totalTaskCount');
    const modeInfo = document.getElementById('modeInfo');
    const newlineSwitch = document.getElementById('newlineSwitch');
    const insertHeaderSwitch = document.getElementById('insertHeaderSwitch');

    columnSelectionCount.textContent = `选中列数: ${columnSelections.size}`;
    totalTaskCount.textContent = `总任务数: ${totalTasks}`;

    let modeText = newlineSwitch.checked ? '换行' : '空格';
    modeText += insertHeaderSwitch.checked ? '，包含标题' : '';
    modeInfo.textContent = `拼接模式: ${modeText}`;
}

function calculateTotalTasks(selectedCells) {
    const columnCounts = {};
    selectedCells.forEach(cell => {
        const columnIndex = cell.cellIndex;
        columnCounts[columnIndex] = (columnCounts[columnIndex] || 0) + 1;
    });
    return Object.values(columnCounts).reduce((a, b) => a * b, 1);
}

function addCellHoverListeners() {
    const excelCells = document.querySelectorAll('#excelContent td');
    const resultCells = document.querySelectorAll('#resultTableBody td');
    const tooltip = document.getElementById('cellContentTooltip');
    
    function addHoverToCell(cell) {
        cell.addEventListener('mouseenter', function(e) {
            const fullText = this.getAttribute('data-full-text') || this.textContent;
            tooltip.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(fullText)}</pre>`;
            tooltip.style.display = 'block';
            
            adjustTooltipPosition(e, tooltip);
            
            // 阻止默认的 tooltip 行为
            e.preventDefault();
            e.stopPropagation();
        });
        
        cell.addEventListener('mouseleave', function() {
            tooltip.style.display = 'none';
        });
        
        // 移除 title 属性（如果存在）
        cell.removeAttribute('title');
    }

    excelCells.forEach(addHoverToCell);
    resultCells.forEach(addHoverToCell);

    // 添加窗口resize事件监听器
    window.addEventListener('resize', () => {
        if (tooltip.style.display === 'block') {
            adjustTooltipPosition(null, tooltip);
        }
    });
}

function adjustTooltipPosition(event, tooltip) {
    const padding = 20; // 距离窗口边缘的padding
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // 重置tooltip大小
    tooltip.style.width = '';
    tooltip.style.height = '';

    // 获取tooltip的实际大小
    const tooltipRect = tooltip.getBoundingClientRect();
    let tooltipWidth = Math.min(tooltipRect.width, windowWidth * 0.8);
    let tooltipHeight = Math.min(tooltipRect.height, windowHeight * 0.8);

    // 调整tooltip大小
    tooltip.style.width = `${tooltipWidth}px`;
    tooltip.style.height = `${tooltipHeight}px`;

    // 计算位置
    let left, top;
    if (event) {
        left = event.clientX + padding;
        top = event.clientY + padding;
    } else {
        // 如果没有事件对象(例如窗口调整大小时),保持当前位置
        const currentRect = tooltip.getBoundingClientRect();
        left = currentRect.left;
        top = currentRect.top;
    }

    // 确保tooltip不会超出窗口边界
    if (left + tooltipWidth > windowWidth - padding) {
        left = windowWidth - tooltipWidth - padding;
    }
    if (top + tooltipHeight > windowHeight - padding) {
        top = windowHeight - tooltipHeight - padding;
    }

    // 设置最终位置
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function addCellClickListeners() {
    const resultCells = document.querySelectorAll('#resultTableBody td');
    
    resultCells.forEach(cell => {
        cell.addEventListener('click', function() {
            const text = this.getAttribute('data-full-text') || this.textContent;
            navigator.clipboard.writeText(text).then(() => {
                showCopyNotification(this);
            });
        });
    });
}

function showCopyNotification(element) {
    const notification = document.createElement('div');
    notification.textContent = '已复制单元格内容';
    notification.style.position = 'absolute';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.color = 'white';
    notification.style.padding = '5px 10px';
    notification.style.borderRadius = '3px';
    notification.style.zIndex = '1000';

    const rect = element.getBoundingClientRect();
    notification.style.left = `${rect.left}px`;
    notification.style.top = `${rect.bottom + 5}px`;

    document.body.appendChild(notification);

    setTimeout(() => {
        document.body.removeChild(notification);
    }, 2000);
}

document.addEventListener('DOMContentLoaded', function() {
    // 现有的代码...

    const exportButton = document.getElementById('exportButton');
    exportButton.addEventListener('click', exportResults);
});

function exportResults() {
    const table = document.getElementById('resultTable');
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll('td, th');
        
        for (let j = 0; j < cols.length; j++) {
            let text = cols[j].getAttribute('data-full-text') || cols[j].innerText;
            // 替换双引号为两个双引号（CSV格式要求）
            text = text.replace(/"/g, '""');
            // 将单元格内容用双引号括起来
            row.push('"' + text + '"');
        }
        csv.push(row.join(','));
    }
    
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "ai_results.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
