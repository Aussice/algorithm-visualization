# Algorithm Visualization Laboratory

<p align="center">
  <strong>See algorithms. See thinking.</strong><br>
  Interactive experiments for understanding how algorithms make decisions.
</p>

<p align="center">
  <a href="https://evolutionary-game-lab.aussice.chatgpt.site">Open Live Laboratory</a>
</p>

## Interface Preview

The laboratory presents algorithms as interactive experiments. Each page combines controls, a live visualization, current metrics, and an explainer section so that the result and the calculation process can be read together.

### Neural network classification

Adjust hidden neurons, learning rate, training speed, and activation function. The decision-boundary field, training metrics, and network architecture update as the model learns.

<p align="center">
  <img src="docs/screenshots/neural-network.png" alt="Neural network classification experiment interface" width="900">
</p>

### Traveling salesman problem

Compare genetic search, 2-opt, and simulated annealing while watching candidate routes, distance metrics, and convergence information change during the search.

<p align="center">
  <img src="docs/screenshots/tsp.png" alt="Traveling salesman problem experiment interface" width="900">
</p>

## Experiments

| Experiment | Main question | Visual focus |
|---|---|---|
| Evolutionary game theory | How can cooperation evolve? | Strategies, payoffs, mutation, selection, and population size |
| Multi-robot coordination | How can robots move without gridlock? | Task assignment, routes, reservations, and deadlock resolution |
| Traveling salesman problem | How does a route improve? | Candidate tours, distance changes, crossover, mutation, and local search |
| Neural network classification | How does a model learn a boundary? | Forward propagation, loss, gradients, and decision regions |
| Q-learning maze | How does an agent learn by trial and error? | Rewards, Q-values, exploration, exploitation, and policy formation |
| Boids swarm intelligence | How does order emerge from local rules? | Separation, alignment, cohesion, neighbors, and obstacle avoidance |

## Learning through experiments

- Change parameters and see their effects immediately.
- Run simulations step by step.
- Inspect intermediate calculations and algorithm decisions.
- Compare different strategies on the same problem.
- Switch between Chinese and English when entering the laboratory.

## Technology

- React
- TypeScript
- Vinext
- CSS
- SVG and Canvas visualizations
- Browser-based simulation
- Cloudflare Sites deployment

## Run locally

Requirements: Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

To create a production build:

```bash
npm run build
```

## Project structure

```text
app/
├── algorithm-hub.tsx
├── simulation-lab.tsx
├── robot-lab.tsx
├── tsp-lab.tsx
├── neural-lab.tsx
├── q-learning-lab.tsx
└── boids-lab.tsx

docs/
└── screenshots/
    ├── neural-network.png
    └── tsp.png
```

## Live site

[Algorithm Visualization Laboratory](https://evolutionary-game-lab.aussice.chatgpt.site)

## License

This project is for learning, demonstration, and experimentation.
