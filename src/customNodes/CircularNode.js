import React from 'react';
import { Handle } from 'react-flow-renderer';
import { useFlow } from '../FlowContext'; // Ensure the correct path
import myImage from '../logo_1.png'; // Update the path accordingly

const CircularNode = ({ id, data }) => {
  const { deleteNode } = useFlow();

  // Dynamically calculate the diameter based on label length
  const diameter = Math.max(200, data.label.length * 5); // Minimum diameter is 120px

  const handleDelete = () => {
    deleteNode(id);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${diameter}px`,
        height: `${diameter}px`,
        backgroundColor: '#D6D5E6',
        borderRadius: '50%', // Makes the div circular
        border: '2px solid #333',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      <Handle type="target" position="top" />
      <img
        src={myImage}
        alt=""
        style={{
          width: '50px',
          height: '50px',
          marginBottom: '10px',
        }}
      />
      <div style={{ fontSize: '14px', wordWrap: 'break-word', padding: '5px' }}>
        {data.label}
      </div>
      <Handle type="source" position="bottom" />
      <button
        onClick={handleDelete}
        style={{
          position: 'absolute',
          bottom: '10px',
          padding: '5px 10px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        Delete
      </button>
    </div>
  );
};

export default CircularNode;