import logger from '../utils/logger.js';

/**
 * Workflow Node
 * Represents a single step in a workflow
 */
export class WorkflowNode {
  constructor(id, type, config = {}) {
    this.id = id;
    this.type = type; // 'ask', 'process', 'action', 'condition', 'loop'
    this.config = config;
    this.output = null;
  }

  async execute(input, context = {}) {
    switch (this.type) {
      case 'ask':
        return this._executeAsk(input, context);
      case 'process':
        return this._executeProcess(input, context);
      case 'action':
        return this._executeAction(input, context);
      case 'condition':
        return this._executeCondition(input, context);
      default:
        throw new Error(`Unknown node type: ${this.type}`);
    }
  }

  async _executeAsk(input, context) {
    // Send question to user via WhatsApp and wait for response
    return {
      nodeId: this.id,
      type: 'ask',
      question: this.config.question,
      responses: []
    };
  }

  async _executeProcess(input, context) {
    // Process input data
    const { processor } = this.config;
    if (typeof processor === 'function') {
      return await processor(input);
    }
    return input;
  }

  async _executeAction(input, context) {
    // Execute action (save data, send message, etc.)
    const { handler } = this.config;
    if (typeof handler === 'function') {
      return await handler(input);
    }
    return input;
  }

  async _executeCondition(input, context) {
    // Evaluate condition
    const { evaluator, thenNode, elseNode } = this.config;
    if (typeof evaluator === 'function') {
      const result = await evaluator(input);
      return {
        nodeId: this.id,
        condition: result,
        nextNode: result ? thenNode : elseNode
      };
    }
    return null;
  }
}

/**
 * Workflow
 * Orchestrates workflow execution
 */
export class Workflow {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.nodes = new Map();
    this.edges = []; // Array of { from: nodeId, to: nodeId }
    this.startNode = null;
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    return this;
  }

  setStartNode(nodeId) {
    this.startNode = nodeId;
    return this;
  }

  addEdge(fromNodeId, toNodeId) {
    this.edges.push({ from: fromNodeId, to: toNodeId });
    return this;
  }

  async execute(input, context = {}) {
    try {
      logger.info('Executing workflow:', { workflowId: this.id, workflowName: this.name });

      let currentNodeId = this.startNode;
      let currentInput = input;
      const executionLog = [];

      while (currentNodeId) {
        const node = this.nodes.get(currentNodeId);

        if (!node) {
          logger.warn('Node not found:', { nodeId: currentNodeId });
          break;
        }

        logger.debug('Executing node:', { nodeId: currentNodeId, type: node.type });

        const result = await node.execute(currentInput, context);
        executionLog.push({
          nodeId: currentNodeId,
          type: node.type,
          result
        });

        // Determine next node
        if (node.type === 'condition' && result.nextNode) {
          currentNodeId = result.nextNode;
        } else {
          const nextEdge = this.edges.find(e => e.from === currentNodeId);
          currentNodeId = nextEdge?.to || null;
        }

        currentInput = result;
      }

      logger.info('Workflow completed:', { workflowId: this.id });
      return {
        workflowId: this.id,
        success: true,
        executionLog,
        finalOutput: currentInput
      };
    } catch (error) {
      logger.error('Workflow execution failed:', error.message);
      throw error;
    }
  }
}

/**
 * Workflow Builder
 * Helper to build workflows
 */
export class WorkflowBuilder {
  constructor(id, name) {
    this.workflow = new Workflow(id, name);
  }

  addAskNode(nodeId, question, options = []) {
    const node = new WorkflowNode(nodeId, 'ask', {
      question,
      options
    });
    this.workflow.addNode(node);
    return this;
  }

  addProcessNode(nodeId, processor) {
    const node = new WorkflowNode(nodeId, 'process', { processor });
    this.workflow.addNode(node);
    return this;
  }

  addActionNode(nodeId, handler) {
    const node = new WorkflowNode(nodeId, 'action', { handler });
    this.workflow.addNode(node);
    return this;
  }

  addConditionNode(nodeId, evaluator, thenNode, elseNode) {
    const node = new WorkflowNode(nodeId, 'condition', {
      evaluator,
      thenNode,
      elseNode
    });
    this.workflow.addNode(node);
    return this;
  }

  setStart(nodeId) {
    this.workflow.setStartNode(nodeId);
    return this;
  }

  connect(fromNodeId, toNodeId) {
    this.workflow.addEdge(fromNodeId, toNodeId);
    return this;
  }

  build() {
    return this.workflow;
  }
}

export default { Workflow, WorkflowNode, WorkflowBuilder };
