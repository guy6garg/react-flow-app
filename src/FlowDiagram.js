import React, { useCallback, useRef } from 'react';
import ReactFlow from 'react-flow-renderer';
import { MiniMap, Controls} from 'react-flow-renderer';
import { useFlow } from './FlowContext';
import ImageNode from './customNodes/ImageNode';
import CircularNode from './customNodes/CircularNode';
import CustomNodeComponent from './customNodes/CustomNodeComponent';
import IconNode from './customNodes/IconNode';
import myImage from './logo_1.png';


// Global branch counter to ensure unique branch tags

// A map to track parent-child relationships
// const parentChildMap = new Map();

const FlowDiagram = () => {
  const { nodes, edges, setNodes, setEdges, history, currentHistoryIndex, setHistory, setCurrentHistoryIndex } = useFlow();
  const reactFlowWrapper = useRef(null);
  const nodeIdRef = useRef(nodes.length + 1);
  // Use a Map to track parent-child relationships
  const parentChildMap = useRef(new Map());
  // Use a Map to track branch counters for each branch path
  const branchCounter = useRef(new Map());
  const convergenceCounter = useRef(new Map()); // Tracks convergence counts for LCAs
  // Push State to History for Undo/Redo
  const pushToHistory = useCallback((newNodes, newEdges) => {
    const newHistory = history.slice(0, currentHistoryIndex + 1);
    newHistory.push({ nodes: newNodes, edges: newEdges });
    setHistory(newHistory);
    setCurrentHistoryIndex(newHistory.length - 1);
  }, [history, currentHistoryIndex]);

   // Add Node Logic
   const addNode = useCallback((type) => {
    let newNode = {
      id: `node_${nodeIdRef.current}`,
      type,
      position: { x: Math.random() * window.innerWidth * 0.5, y: Math.random() * window.innerHeight * 0.5 },
      data: { label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node ${nodeIdRef.current++}`, 
              color: getNodeColor(type),
              branch: null, // Default branch null for new nodes
              level: 1} // Default level 1 for new nodes
    };

    if (type === 'imageNode') {
      newNode.data.imageUrl = myImage;
    }
    const newNodes = [...nodes, newNode];
    pushToHistory(newNodes, edges);
    setNodes(newNodes);
  }, [nodes, edges, pushToHistory]);


 // Helper function to check if a connection violates branch rules
  function shouldPreventConnection(sourceNode, targetNode) {
    // Rule 1: Prevent direct connections between same node
    if (sourceNode === targetNode){
      alert("Can't connect a same node.....");
      return true;
    }
    if(edges.some(edge => edge.source === sourceNode.id && edge.target === targetNode.id)){
      alert("Node already connected.....");
      return true;
    }
    // Rule 2: Prevent direct connections between circular nodes
    if (sourceNode.type === 'circular' && targetNode.type === 'circular') {
      alert("Can't connect two circular nodes.");
      return true;
    }

    // Rule 3: Prevent connections between different branches (unless circular convergence)
    const sourceBranch = sourceNode.data.branch;
    const targetBranch = targetNode.data.branch;

    if (sourceBranch && targetBranch && sourceBranch !== targetBranch) {
      if (targetNode.type !== 'circular') {
        alert(`Cannot connect nodes from different branches: ${sourceBranch} to ${targetBranch}`);
        return true;
      }
    }

    // Rule 4: Prevent loops
    const createsLoop = edges.some(edge => edge.source === targetNode.id && edge.target === sourceNode.id);
    if (createsLoop) {
      alert("This connection creates a loop, which is not allowed.");
      return true;
    }

    // Rule 5: Prevent more than one connection from non circular node
    if (sourceNode.type !== 'circular'){
      if (edges.filter(edge => edge.source === sourceNode.id).length >= 1){
        alert("Can't connect more than one connection from a non circular node. Add a circular node to connect multiple nodes.");
        return true;
      }
      if(targetNode.type !== 'circular' && targetNode.data.branch!==null){
        alert("Cannot connect nodes from different branches");
        return true;
      }
    }

    return false; // Connection is valid
  }

  // Function to generate a unique branch name for diverging branches
  function generateBranchName(parentNodeBranchPath) {
    if (!branchCounter.hasOwnProperty(parentNodeBranchPath)) {
      branchCounter[parentNodeBranchPath] = 1;
    } else {
      branchCounter[parentNodeBranchPath] += 1;
    }
    return `${parentNodeBranchPath}.${branchCounter[parentNodeBranchPath]}`;
  }

  const findLCA = (branches) => {
    if (branches.length === 0) return "";
    if (branches.length === 1) return branches[0];
  
    // Split each branch into parts
    const branchParts = branches.map((branch) => branch.split("."));
  
    let lca = branchParts[0]; // Start with the first branch parts
    for (let i = 1; i < branchParts.length; i++) {
      const currentBranch = branchParts[i];
      lca = lca.slice(0, currentBranch.length).filter((part, index) => part === currentBranch[index]);
    }
  
    // Join the LCA parts back into a string
    return lca.join(".");
  };

  // Enhanced connection handler with branch restrictions
  const onConnect = useCallback((params) => {
    const { source, target } = params;
    const sourceNode = nodes.find((n) => n.id === source);
    const targetNode = nodes.find((n) => n.id === target);
  
    if (!sourceNode || !targetNode) return;
  
    // Prevent invalid connections
    if (shouldPreventConnection(sourceNode, targetNode)) {
      return;
    }
  
     // Identify if the target is a circular node
    const isTargetCircular = targetNode.type === 'circular';

    const newLevel = (sourceNode.data.level || 1) + 1;  
    // Generate unique branch name for diverging branches
    let newBranchName;
    if( sourceNode.type === 'circular'){
    const sourceBranchPath = sourceNode.data.branch || `b_${source}`;
    newBranchName = generateBranchName(sourceBranchPath);
    }
    else{
      newBranchName = sourceNode.data.branch || `b_${source}`;
    }
   
    // Update nodes with branch labels and ensure proper end node tagging
    let updatedNodes;
    let aggregatedBranchLabel;
    updatedNodes = nodes.map((node) => {
      // Remove "Parallel End" label from previous end node
      if (node.id === source) {
        if(isTargetCircular){ // Since, the source node would be last node of the branch, that's why we are not removing end label from it
          return node;
        }
        return {
          ...node,
          data: {
            ...node.data,
            color: getNodeColor('default'),
            label: node.data.label.replace(/ - Parallel End(.*)?/, ''),
          },
        };
      } 
  
      // Mark the target node as the new "Parallel End" with branch label
      if (node.id === target) {
        if(isTargetCircular){
          // Handle multiple branch convergence
            const incomingBranches = edges.filter((edge) => edge.target === target).map((edge) => {
              const sourceNode = nodes.find((n) => n.id === edge.source);
              return sourceNode?.data?.branch || `b_${edge.source}`;
            });

            incomingBranches.push(newBranchName);
             // Find Lowest Common Ancestor (LCA)
            const lcaBranch = findLCA(incomingBranches);

            // Generate a unique label for the circular node
             // Check if the aggregated label is already used
            let convergenceSuffix = 1;
            if (convergenceCounter.current.has(lcaBranch)) {
              convergenceSuffix = convergenceCounter.current.get(lcaBranch) + 1;
            }
            convergenceCounter.current.set(lcaBranch, convergenceSuffix);

            aggregatedBranchLabel = `${lcaBranch}`;

          return {
            ...node,
            data: {
              ...node.data,
              label: `${node.data.label.replace(/ - Parallel End(.*)?/, '')} ${(edges.filter(edge => edge.source === node.id).length >= 1)? ((node.data.label.includes('Parallel End') )? `- Parallel End ${aggregatedBranchLabel}`:``) :(node.data.label.includes('Parallel End'))? `- Parallel End ${aggregatedBranchLabel}`:`- Parallel End ${newBranchName}`}`,
              color: getNodeColor('circular'),
              branch: aggregatedBranchLabel,
              level: targetNode.data.level === 1 ? newLevel : Math.max(newLevel,targetNode.data.level)
            },
          };
        }
        return {
          ...node,
          data: {
            ...node.data,
            label: `${node.data.label} - Parallel End ${newBranchName}`,
            color: getNodeColor('end'),
            branch: newBranchName, 
            level: targetNode.data.level === 1 ? newLevel : Math.max(newLevel,targetNode.data.level)
          },
        };
      }
  
      return node;
    });

    // Propagate branch updates to descendants for circular nodes
    if (isTargetCircular) {
      updatedNodes = propagateBranchUpdate(target, aggregatedBranchLabel, updatedNodes);
    }
    // Update parent-child relationship
    if (!parentChildMap.current.has(source)) {
      parentChildMap.current.set(source, new Set());
    }
    parentChildMap.current.get(source).add(target);

    // Update edges and nodes state
    setNodes(updatedNodes);
    setEdges((eds) => [...eds, { id: `e${source}-${target}`, ...params }]);
  }, [nodes, edges, setNodes, setEdges]);

  // Recursive function to propagate branch updates to all descendant nodes
  const propagateBranchUpdate = (parentNodeId, parentBranchName, updatedNodes) => {
    const descendants = parentChildMap.current.get(parentNodeId) || new Set();
  
    descendants.forEach((childId) => {
      const childNode = updatedNodes.find((node) => node.id === childId);
  
      if (childNode) {
        // Check if the child node is circular
        const isChildCircular = childNode.type === "circularNode"; // Adjust if circular node type differs
  
        if (isChildCircular) {
          // Gather all incoming branches to this circular node
          const incomingBranches = edges.filter((edge) => edge.target === childId).map((edge) => {
              const sourceNode = updatedNodes.find((n) => n.id === edge.source);
              return sourceNode?.data?.branch || `branch_${edge.source}`;
            });
  
          // Include the current parent's branch in the aggregation
          incomingBranches.push(parentBranchName);
           // Find Lowest Common Ancestor (LCA)
          const lcaBranch = findLCA(incomingBranches);

          // Generate a unique label for the circular node
          // Check if the aggregated label is already used
          let convergenceSuffix = 1;
          if (convergenceCounter.current.has(lcaBranch)) {
            convergenceSuffix = convergenceCounter.current.get(lcaBranch) + 1;
          }
          convergenceCounter.current.set(lcaBranch, convergenceSuffix);
          const aggregatedBranchLabel = `${lcaBranch}`;
      
          // Update the circular node's branch and label
          updatedNodes = updatedNodes.map((node) =>
            node.id === childId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    branch: aggregatedBranchLabel,
                    label: `${node.data.label.split("-")[0]} - ${aggregatedBranchLabel}`,
                  },
                }
              : node
          );
  
          // Propagate the new branch label further to this circular node's descendants
          updatedNodes = propagateBranchUpdate(childId, aggregatedBranchLabel, updatedNodes, edges);
        } else {
          // For non-circular nodes, handle as usual
  
          // Get or initialize the branch counter for the parent branch
          if (!branchCounter.current.has(parentBranchName)) {
            branchCounter.current.set(parentBranchName, 0);
          }
  
          // Increment the counter for the parent branch
          const childBranchSuffix = branchCounter.current.get(parentBranchName) + 1;
          branchCounter.current.set(parentBranchName, childBranchSuffix);
  
          // Generate the new branch name for the child
          const childBranchName = `${parentBranchName}.${childBranchSuffix}`;
  
          // Update the child's branch label
          updatedNodes = updatedNodes.map((node) =>
            node.id === childId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    branch: childBranchName,
                    label: node.data.color == getNodeColor('end') ? `${node.data.label.split("-")[0]} - ${childBranchName}`: `${node.data.label}`,
                  },
                }
              : node
          );
  
          // Recursively propagate the update to further descendants
          updatedNodes = propagateBranchUpdate(childId, childBranchName, updatedNodes, edges);
        }
      }
    });
  
    return updatedNodes;
  };
  // Equispace Parallel Nodes
  const makeNodesEquispacedAndCentered = useCallback(() => {
    if (!reactFlowWrapper.current) return;
  
    const verticalSpacing = 250; // Vertical spacing between levels
    const horizontalSpacing = 500; // Minimum horizontal spacing between nodes within the same level
    const containerWidth = reactFlowWrapper.current.offsetWidth;
  
    // Group nodes by levels
    const levelMap = nodes.reduce((group, node) => {
      const level = node.data.level;
      if (!group[level]) {
        group[level] = [];
      }
      group[level].push(node);
      return group;
    }, {});
  
    // Calculate positions for each level
    const updatedNodes = Object.keys(levelMap).flatMap(level => {
      const nodesAtLevel = levelMap[level];
      const numNodes = nodesAtLevel.length;
      const totalWidth = (numNodes - 1) * horizontalSpacing;
      const startX = (containerWidth - totalWidth) / 2; // Center nodes at this level
  
      return nodesAtLevel.map((node, index) => ({
        ...node,
        position: { x: startX + index * horizontalSpacing, y: (level - 1) * verticalSpacing + 100 }
      }));
    });
  
    pushToHistory(updatedNodes, edges);
    setNodes(updatedNodes);
  }, [nodes, edges, pushToHistory]);

  // Undo/Redo Logic
  const undo = useCallback(() => {
    if (currentHistoryIndex === 0) return;
    const newIndex = currentHistoryIndex - 1;
    const prevState = history[newIndex];
    setCurrentHistoryIndex(newIndex);
    setNodes(prevState.nodes);
    setEdges(prevState.edges);
  }, [history, currentHistoryIndex]);

  const redo = useCallback(() => {
    if (currentHistoryIndex >= history.length - 1) return;
    const newIndex = currentHistoryIndex + 1;
    const nextState = history[newIndex];
    setCurrentHistoryIndex(newIndex);
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
  }, [history, currentHistoryIndex]);

  const onNodeDragStop = useCallback((event, node) => {
    const newNodes = nodes.map((nd) => {
      if (nd.id === node.id) {
        return {
          ...nd,
          position: node.position,
        };
      }
      return nd;
    });
    pushToHistory(newNodes, edges);
    setNodes(newNodes);
    
  }, [nodes, edges, pushToHistory]);

  const nodeTypes = {
    customNodeType: CustomNodeComponent,
    circular: CircularNode,
    imageNode: ImageNode,
    iconNode: IconNode,
  };
  const nodeColor = {
    circular: 'gray',
    end: 'yellow',
    default: 'lightblue',
  };
  // Helper function to get node color
  const getNodeColor = (type) => {
    if (type === 'end') return nodeColor.end;
    if (type === 'circular') return nodeColor.circular;
    return nodeColor.default;
  };

  // Render Legend
  // Render Legend (Small Box)
  const renderLegend = () => (
    <div style={legendStyle}>
      <h4 style={{ margin: "5px 0", fontSize: "14px" }}>Legend</h4>
      <div style={legendItem}>
        <div style={{ ...legendColorBox, backgroundColor: "lightblue" }}></div>
        <span>Regular</span>
      </div>
      <div style={legendItem}>
        <div style={{ ...legendColorBox, backgroundColor: "gray" }}></div>
        <span>Circular</span>
      </div>
      <div style={legendItem}>
        <div style={{ ...legendColorBox, backgroundColor: "yellow" }}></div>
        <span>End</span>
      </div>
    </div>
  );

  // Styles for the legend
  const legendStyle = {
    position: "absolute",
    top: "10px",
    right: "10px",
    border: "1px solid #ccc",
    padding: "8px",
    borderRadius: "5px",
    backgroundColor: "#f9f9f9",
    zIndex: 10,
    width: "120px",
    fontSize: "12px",
    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
  };

  const legendItem = {
    display: "flex",
    alignItems: "center",
    marginBottom: "5px",
  };

  const legendColorBox = {
    width: "15px",
    height: "15px",
    marginRight: "8px",
    borderRadius: "3px",
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ justifyContent: 'space-evenly', padding: '10px' }}>
        <button onClick={makeNodesEquispacedAndCentered}>Equispace Nodes</button>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
        <button onClick={() => addNode('circular')}>Add Circular Node</button>
        <button onClick={() => addNode('iconNode')}>Add ICON Node</button>
        <button onClick={() => addNode('imageNode')}>Add Image Node</button>
        <button onClick={() => addNode('default')}>Add Default Node</button>
      </div>
      {renderLegend()}
      <div ref={reactFlowWrapper} style={{ height: '100vh' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeDragStop={onNodeDragStop}
        >
           <MiniMap 
            nodeColor={(node) => (node.type === 'circular' ? 'gray' : (node.data.label?.includes('Parallel End') ? 'yellow' :'lightblue'))}
            />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};

export default FlowDiagram;