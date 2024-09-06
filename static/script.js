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
    // 不需要重新获取模型列表,直接使用已经获取的数据
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

    // 按列分组选中的单元格
    selectedCells.forEach(cell => {
        const columnIndex = cell.cellIndex;
        if (!columnSelections[columnIndex]) {
            columnSelections[columnIndex] = [];
        }
        columnSelections[columnIndex].push(cell.textContent.trim());
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
    return combinations.map(combination => combination.join(' '));
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

function addResultRow(prompt, status, timestamp, result, tokenCount) {
    const resultTableBody = document.getElementById('resultTableBody');
    const row = resultTableBody.insertRow();
    row.innerHTML = `
        <td>${prompt}</td>
        <td class="task-status-${status}">${getStatusText(status)}</td>
        <td>${timestamp}</td>
        <td>${result}</td>
        <td>${tokenCount}</td>
    `;
    row.id = `result-row-${prompt}`;
}

function updateResultStatus(prompt, status, result, tokenCount) {
    const row = document.getElementById(`result-row-${prompt}`);
    if (row) {
        row.cells[1].className = `task-status-${status}`;
        row.cells[1].textContent = getStatusText(status);
        row.cells[2].textContent = new Date().toLocaleString();
        row.cells[3].textContent = result;
        row.cells[4].textContent = tokenCount;
    }
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
            const truncatedContent = cellContent.length > 100 
                ? cellContent.substring(0, 100) + '...' 
                : cellContent;
            tableHTML += `<td data-full-text="${escapeHtml(cellContent)}">${escapeHtml(truncatedContent)}</td>`;
        });
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    excelContent.innerHTML = tableHTML;
    
    // 显示提交按钮
    document.getElementById('submitBtn').style.display = 'block';
    
    // 添加单元格选择功能
    addCellSelectionListeners();
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
    const table = document.querySelector('#excelContent table');
    const selectedCells = table.querySelectorAll('.selected-cell');
    const columnSelectionCount = document.getElementById('columnSelectionCount');
    const totalTaskCount = document.getElementById('totalTaskCount');
    
    const columnSelections = {};

    // 按列分组选中的单元格
    selectedCells.forEach(cell => {
        const columnIndex = cell.cellIndex;
        if (!columnSelections[columnIndex]) {
            columnSelections[columnIndex] = [];
        }
        columnSelections[columnIndex].push(cell.textContent.trim());
    });

    const selectedColumns = Object.keys(columnSelections).length;
    const totalTasks = Object.values(columnSelections).reduce((acc, curr) => acc * curr.length, 1);

    columnSelectionCount.textContent = `选中列数: ${selectedColumns}`;
    totalTaskCount.textContent = `总任务数: ${totalTasks}`;
}
