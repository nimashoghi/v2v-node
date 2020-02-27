# %%
import json
import networkx as nx

# %% Complete Grpah
# G = nx.complete_graph(10)
G = nx.read_gpickle("./complete.gpickle")
nx.draw_networkx(G)
# nx.write_gpickle(G, "./complete.gpickle")
complete = G

# %% Line Grpah
# G = nx.grid_graph(dim=[10])
G = nx.read_gpickle("./line.gpickle")
nx.draw_networkx(G)
# nx.write_gpickle(G, "./line.gpickle")
line = G

# %% Triangular Lattice
# G = nx.triangular_lattice_graph(5, 5)
G = nx.read_gpickle("./triangular.gpickle")
nx.draw_networkx(G)
# nx.write_gpickle(G, "./triangular.gpickle")
triangular = G

# %%
import random


def get_random_events(node, adjacent):
    for i in range(0, 50):
        timestamp = 10 * (i + random.uniform(0, 1))
        yield dict(node=str(node), target=str(adjacent), timestamp=timestamp)


def process_graph(G: nx.Graph):
    for node in G.nodes:
        events = [
            item
            for adjacent in G.adj[node]
            for item in (get_random_events(node, adjacent))
        ]
        events.sort(key=lambda value: value["timestamp"])
        yield dict(node=node, events=events)


events = {str(value["node"]): value["events"] for value in process_graph(triangular)}


# %%
import json

with open("./events.json", "w") as f:
    json.dump(events, f, indent=4)


# %%
