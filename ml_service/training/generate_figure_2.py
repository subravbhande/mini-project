import os
import matplotlib.pyplot as plt
import numpy as np

# Ensure directories exist
os.makedirs("docs/figures", exist_ok=True)
artifact_dir = r"C:\Users\subra\.gemini\antigravity\brain\3dfc4df3-2891-4732-993b-3b0649dacb63"
os.makedirs(artifact_dir, exist_ok=True)

# Data points from Table 9
x = np.array([0, 1, 2, 3, 4, 5])
y = np.array([0.0, 1.49, 3.12, 4.62, -0.37, -7.82])

# Configure styling
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['font.size'] = 10.5
plt.rcParams['axes.linewidth'] = 1.0

fig, ax = plt.subplots(figsize=(7.5, 3.8), dpi=300)

# Reference horizontal lines
ax.axhline(0, color='black', linewidth=1.0, zorder=2)
ax.axhline(3.0, color='#6b7280', linestyle='--', linewidth=1.0, zorder=1)
ax.axhline(1.0, color='#9ca3af', linestyle=':', linewidth=1.2, zorder=1)

# Text labels for thresholds on right
ax.text(5.08, 3.15, '3% hold threshold', color='#4b5563', fontsize=9.5, ha='right', va='bottom')
ax.text(5.08, 1.15, '1% sell threshold', color='#4b5563', fontsize=9.5, ha='right', va='bottom')

# Main trajectory plot
ax.plot(x, y, color='#1e293b', linewidth=2.2, marker='o', markersize=7.5,
        markerfacecolor='#1e293b', markeredgecolor='#1e293b', zorder=4)

# Annotation for peak at day 3
ax.annotate(
    'Peak: day 3, 4.6%',
    xy=(3, 4.62),
    xytext=(2.2, 5.8),
    arrowprops=dict(arrowstyle='-', color='#4b5563', lw=1.1),
    fontsize=9.5,
    color='#111827',
    ha='center',
    va='bottom'
)

# Set axis limits & ticks
ax.set_xlim(-0.2, 5.2)
ax.set_ylim(-9.0, 7.0)
ax.set_xticks([0, 1, 2, 3, 4, 5])
ax.set_yticks([-8, -6, -4, -2, 0, 2, 4, 6])

# Axis labels
ax.set_xlabel('Days held after today (t)', fontsize=11, labelpad=8, color='#111827')
ax.set_ylabel('Net uplift vs. selling today (%)', fontsize=11, labelpad=8, color='#111827')

# Clean minimalist spines (academic publication style)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color('black')
ax.spines['bottom'].set_color('black')
ax.tick_params(axis='both', which='both', length=4, width=1.0, color='black')

# Caption below the plot
plt.figtext(
    0.5, -0.05,
    'Figure 2. Net uplift against selling today for the illustrative lot.',
    ha='center', fontsize=10, style='italic', color='#374151'
)

plt.tight_layout()

# Save outputs
png_path = "docs/figures/figure_2_nrv_uplift.png"
svg_path = "docs/figures/figure_2_nrv_uplift.svg"
artifact_png = os.path.join(artifact_dir, "figure_2_nrv_uplift.png")

plt.savefig(png_path, dpi=300, bbox_inches='tight', facecolor='white')
plt.savefig(svg_path, bbox_inches='tight', facecolor='white')
plt.savefig(artifact_png, dpi=300, bbox_inches='tight', facecolor='white')

print(f"Saved successfully to:")
print(f" - {png_path}")
print(f" - {svg_path}")
print(f" - {artifact_png}")
